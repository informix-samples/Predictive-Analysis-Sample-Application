/*
 * This file simulates a sensor by creating data and uploading to a database via its own connection.
 * The data created by this fake sensor is not accessed locally by any other file.
 * It instead uses the database as a median between the data and the analytics.
 */

//dependencies
var ibmdb = require('ibm_db');

var connection = null;
var timer = null;
var sensorUploadSpeed = 2000; //how often the sensor will upload data in milliseconds
var tempToSend = 2; // start at 2 celsius (apprx. 36F)
var quadraticCounter = 1;
var sensorID = 1; //specify the id of the sensor
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

exports.connection = function() {
	// establish a connection to db
	ibmdb.open(url, function(err, conn) {
		if (err != null)
			return console.error("[ERROR]: ", err.message);
		else {
			console.log("Connected to " + url);
			connection = conn;
		}
	});
}


exports.generateFakeData = function(socket, delta) {
	//called every time a button is pressed
	
	if (timer != null) {
		clearInterval(timer);
	}
	
	quadraticCounter = 1; //increase this each time to make slope not linear
	
	timer = setInterval(function() {
		
		tempToSend = delta*quadraticCounter + tempToSend;
		quadraticCounter = quadraticCounter + .25;
		
		var timestamp =  new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '').trim(); //get a timestamp in GMT time with the format that Informix accepts
		
		console.log(" ----- SENSOR DATA ----- ");
		console.log("Timestamp : ", timestamp);
		console.log("Temperature Reading : ", tempToSend);
		console.log("Delta : " + delta + ", quadraticCounter : " + quadraticCounter);
		console.log("<------------------------>");
		
		var sql = "insert into thermos_vti (thermometer_id, tstamp_gmt, celsius) values (" + sensorID + ", \"" + timestamp + "\"::DATETIME YEAR TO FRACTION(5), " + tempToSend + ")";
		var result = connection.prepareSync(sql).executeSync();
		result.closeSync();
		socket.emit('newData');
	}, sensorUploadSpeed);
}