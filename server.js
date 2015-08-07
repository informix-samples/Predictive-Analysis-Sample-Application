//dependencies
var express = require('express');
var app = express();
var ibmdb = require('ibm_db');
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var connection = require('./connection.js');
var sensor = require('./sensor.js');
var analytics = require('./analytics.js');

//connection information
var host;// = '';
var port;// = '';
var database;// = '';
var username;// = '';
var password;// = '';
var url;// = "HOSTNAME=" + host + ";PORT=" + port + ";DATABASE="+ database + ";PROTOCOL=TCPIP;UID=" + username +";PWD="+ password + ";";

parseVcap();
//This method will get the connection information from bluemix.
function parseVcap(){
	var vcap_services = JSON.parse(process.env.VCAP_SERVICES);
	var credentials = vcap_services['timeseriesdatabase'][0].credentials;
	host = credentials.host;
	port = credentials.drda_port;
	database = credentials.db;
	username = credentials.username;
	password = credentials.password;
	
	url = "HOSTNAME=" + host + ";PORT=" + port + ";DATABASE="+ database + ";PROTOCOL=TCPIP;UID=" + username +";PWD="+ password + ";";
}
app.use(express.static(__dirname + '/public'));

/*
 * The runAnalysis variable changes how often the analytics are run. It is in reference
 * to how many times the sensor emits new data to the database. 
 * 
 * Example: runAnalysis >= 2 and the sensor uploads data every 2 seconds, the analysis will try to run every 6 seconds
 */
var runAnalysis = 0;
io.sockets.on('connection', function(socket){
	
	socket.on('raiseTemp', function() {
		sensor.generateFakeData(socket, .125);
	});
	
	socket.on('holdTemp', function() {
		sensor.generateFakeData(socket, 0);
	});
	
	socket.on('lowerTemp', function() {
		sensor.generateFakeData(socket, -.125);
	});
	
	socket.on('getData', function(){
		var latestDataFromSensor = connection.pullData();
		socket.emit('updateData', latestDataFromSensor);
		runAnalysis++;
		if (runAnalysis >= 2) {
			runAnalysis = 0;
			analytics.analyze(socket, latestDataFromSensor);
		}
	});
});


app.get('/simulation', function(req, res) {
	res.sendFile(__dirname + '/views/monitor.html');
	console.log("Starting Simulation ...");
});

app.get('/', function(req, res) {
	connection.dbConnect(url);
	sensor.connection();
	res.sendFile(__dirname + '/views/index.html');
});

server.listen(port,  function() {
	console.log("Server starting on " + port);
});