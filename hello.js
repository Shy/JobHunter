// Load the fs (filesystem) module
var fs = require("fs");
var https = require("https");
var underscore = require("underscore");
var async = require("async");


function getPerson(cb) {
    fs.readFile("example_person.json", "utf8", function (err,data){
        var person = JSON.parse(data);
        cb(null, person.person);
    });
}

function getAngelData(path, cb) {
    var url;
    if (path !== null) {
        url = "https://api.angel.co/1/" + path;
    }else{
        url = "https://api.angel.co/1/jobs";
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

function checkForMultiple(job_field, role, cb){ // Given a json field that returns array check for all array elements in string
    for (var i in role){
        if(job_field.indexOf(role[i]) > -1 ) {
            return true;
        }
    }
}

function findViableJobs(jobs, person, cb){
    var viable_job = [];
    jobs.forEach(function(job){
        if (job.job_type == person.job_type){
            if(checkForMultiple(job.title, person.role) === true){
                viable_job.push(job.id);
            }
        }
    });
    return viable_job;
}

//Load AngelList API and Get Person.
getPerson(function (err,person) {

    var location_queries = [];

    person.location_desired.forEach(function(location_desired){ // Build Location Paths
        location_queries.push("search?query=" + location_desired + "&type=LocationTag");
    });

    async.map(location_queries, getAngelData.bind(null), function(err, data){ // Get Location IDs
        var locations = underscore.flatten(data, true);
        var location_path = [];

        locations.forEach(function(location){ // Build search paths based on location
            location_path.push("tags/" + location.id + "/jobs");
        });

        async.map(location_path, getAngelData.bind(null), function(err, data){ // Get jobs

            var jobs = underscore.flatten(data, true);
            jobs = underscore.pluck(jobs, "jobs");
            jobs = underscore.flatten(jobs, true);

            var viable_job = findViableJobs(jobs, person); // Check Jobs for viability based on user set criteria

            console.log(viable_job);
        });
    });

    // getAngelData('/32886', function(err,data){
    //     console.log(data);
    // });
} );