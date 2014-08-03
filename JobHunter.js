// Example Json Array avliable at example_person.json
var fs = require("fs");
var https = require("https");
var _ = require("underscore");
var async = require("async");


if (process.argv.length < 3){
    console.log("Require JSON File Input");
    process.exit(1);
}

function getPerson(cb) {
    fs.readFile(process.argv[2], "utf8", function (err,data){
        var person = JSON.parse(data);
        cb(null, person.person);
    });
}

// Calls Angel List Api
function getAngelData(path, cb) {
    var url;
    if (path !== null) {
        url = "https://api.angel.co/1/" + path;
    }

    https.get(url, function(res) {
        var body = '';
        res.on('data', function(chunk) {
            body += chunk;
        });

        res.on('end', function() {
            var angellist = JSON.parse(body);
            cb(null, angellist);
        });
    }).on('error', function(e) {
          console.log("Got error: ", e);
    });
}

// Given a json field that returns array check for all array elements in string and ranks based on occurence
function rankForMultiple(job_field, role, cb){
    var rank = 0;
    role.forEach(function(role){
        if (job_field !== null){
            if(job_field.toLowerCase().indexOf(role.toLowerCase()) > -1 ) {
                rank++;
            }
        }
    });
    return rank;
}

function findViableJobs(jobs, person, cb){
    var viable_jobs = [];
    var job_rank;
    var id_list = [];
    jobs.forEach(function(job){

        var updated_at = new Date(job.updated_at);
        var current_date = new Date();
        // Ignore duplicate listings
        if (id_list.indexOf(job.id) === -1){
            id_list.push(job.id);
            // Calculate age to Ignore job postings older than user selected period in months.
            var job_age = current_date.getMonth() - updated_at.getMonth() + (12 * (current_date.getFullYear() - updated_at.getFullYear()));
            if (job_age <= person.job_posting_age &&
                job.job_type === person.job_type &&
                job.salary_min >= person.salary_min &&
                person.current_employer.toLowerCase() !== job.startup.name.toLowerCase()){

                var title_rank = rankForMultiple(job.title, person.role);
                // Rank jobs based on roles.
                if ( title_rank > 0){
                    //Rank job based on Tech Stack
                    job_rank = title_rank + rankForMultiple(job.description + job.title, person.stack);
                    if(job_rank > 0){
                        viable_jobs.push([job_rank, job.id, job.startup.name, job.title, job.angellist_url]);
                    }
                }
            }
        }
    });
    return _.uniq(viable_jobs, false);
}

//Load AngelList API and Get Person.
getPerson(function (err, person) {

    if (person.current_employer.toLowerCase() === 'lob'){
        console.log("You currently work at Lob. Why do you need a new job?");
    }
    console.log("Processing Angel List API. . .\n");

    var location_queries = [];

    // Build array of Location Paths
    person.location_desired.forEach(function(location_desired){
        location_queries.push("search?query=" + location_desired + "&type=LocationTag");
    });

    // Get Location IDs
    async.map(location_queries, getAngelData.bind(null), function(err, data){

        // async.map returns array of arrays, flatten fixes that
        var locations = _.flatten(data, true);
        var location_path = [];

        // Build search paths based on location
        locations.forEach(function(location){
            location_path.push("tags/" + location.id + "/jobs");
        });

        // Get jobs
        async.map(location_path, getAngelData.bind(null), function(err, data){

            var jobs = _.flatten(data, true);
            jobs = _.pluck(jobs, "jobs");
            jobs = _.flatten(jobs, true);

            // Check Jobs for viability based on user set criteria
            var viable_jobs = findViableJobs(jobs, person);

            // negative sort by rank
            viable_jobs = viable_jobs.sort(function(a, b){return b[0]-a[0];});

            // limit to 10 and display
            viable_jobs.splice(0,10).forEach(function(job) {
                console.log("Company: " + job[2]);
                console.log("Role: " + job[3]);
                console.log("More Info: " + job[4] + "\n");
            });

        });
    });
} );
