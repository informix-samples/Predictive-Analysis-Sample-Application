//dependencies
var ibmdb = require('ibm_db');

var connection = null;
var sensorID = 1;//specify which sensor data to use

exports.dbConnect = function(url) {
	ibmdb.open(url, function(err, conn) {
		if (err != null)
			return console.error("[ERROR]: ", err.message);
		else {
			console.log("Connected to " + url);
			connection = conn;
			dbInit();
		}
	});
}


function dbInit() {
	/*
	 * This function resets and creates a timeseries database on Informix
	 * Here is the procedure:
	 * 1. Tell time series that we want intervals between data of 1 second, in this case we named our pattern 'onesec'
	 * 2. Specify when the data is to start storing (2014-01-01 00:00:00) and which interval to use ('onesec')
	 * 3. Make sure there is not a table thrmos_vti (main table that holds everything (sensor id, time, temp))
	 * 4. Make sure there is not a table thermometers (table that holds id for sensors and time&temp row type)
	 * 5. Make sure there is not a container named thermometer_readings
	 * 6. Make sure there is not a row named thermometer_reading (row type that holds timestamp and temp)
	 * 7. Create a row type named thermometer_reading (holds timestamp and temp)
	 * 8. Create a container named thermomemter_readings
	 * 9. Create a table named thermometers (holds which thermometer sent data and row type w time&temp)
	 * 10. Create a virtual table named thrmos_vti based off of thermometers table (seperates time & temp rowtype to their own columns)
	 * 11. Drop the sequence to change sensor_id (sequence is here for example purposes)
	 * 12. Create a sequence to change sendor_id by 1 to show examples of varying sensor ids
	 */
	var sql = [];
	sql.push("insert into CalendarPatterns " 
			+ "select 'onesec','{1 on}, second' from sysmaster:sysdual "
			+ "where not exists (select 1 from CalendarPatterns where cp_name = 'onesec')");
	sql.push("insert into CalendarTable(c_name, c_calendar)  "
			+ "select 'onesec', "
			+ "'startdate(2014-01-01 00:00:00), pattstart(2014-01-01 00:00:00), pattname(onesec)'  "
			+ "from sysmaster:sysdual "
			+ "where not exists (select 1 from CalendarTable where c_name = 'onesec') ");
	sql.push("drop table if exists thermos_vti");
	sql.push("drop table if exists thermometers");
	sql.push("drop row type if exists thermometer_reading restrict;");
	sql.push("create row type thermometer_reading ( "
			+ "tstamp_gmt       datetime year to fraction(5), "
			+ "celsius     real " + ")");
	sql.push("execute procedure TSContainerDestroy('thermometer_readings')");
	sql.push("execute procedure TSContainerCreate( "
			+ "    'thermometer_readings',  " + "    'rootdbs',  "
			+ "    'thermometer',  " + "    0, " + "    0, "
			+ "    '2014-01-01 00:00:00'::datetime year to second, "
			+ "    'day', " // window interval
			+ "    2,  " // active window size
			+ "    3, " // dormant window size
			+ "    null, "
			+ "    1)"); // window control
	sql.push("create table thermometers( "
			+ "        thermometer_id	    int PRIMARY KEY CONSTRAINT thermometer_id, "
			+ "        celsius_series	TimeSeries(thermometer_reading) "
			+ ")");
	sql.push("EXECUTE PROCEDURE TSCreateVirtualTab('thermos_vti', 'thermometers', "
			+ "'origin(2014-01-01 00:00:00),calendar(onesec),container(thermometer_readings),threshold(0),irregular'"
			+ ", 'scan_discreet')");
	sql.push("DROP SEQUENCE IF EXISTS sensor_id");
	sql.push("CREATE SEQUENCE sensor_id INCREMENT BY 1 START WITH 1 CYCLE NOCACHE");

	executeStatements(sql, null, null, null);
};

function executeStatements(sql, sensorID, timestamp, temperature) {
	if (connection != null) {
		for (var i = 0; i < sql.length; i++) {

			var error, result = connection.prepareSync(sql[i]).executeSync([sensorID, timestamp, temperature]);
			if (error != null)
				console.log("[ERROR]: ", error.message);
			else
				console.log("[SUCCESS] : ", sql[i]);
			result.closeSync();
		}
	} else {
		console.log("No connection found.");
	}
}

exports.pullData = function(){
	
	console.log(" ----- PULL DATA ----- ");
	
	//get latest temperature reading
	sql = "select first 1 celsius, tstamp_gmt from thermos_vti "
		+ "where thermometer_id = " + sensorID + " and celsius is not null " 
		+ "order by 2 desc";
	var latestTemp = connection.querySync(sql);
	console.log("[DATA-PULLED] : Latest Temp -> ", latestTemp);
	
	//get average temperature reading
	sql = "select avg(celsius) from thermos_vti where thermometer_id = " + sensorID;
	var averageTemp = connection.querySync(sql);
	console.log("[DATA-PULLED] : Average Temp -> ", averageTemp);
	
	//get recent temperature readings
	var timestamp =  new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '').trim();
	sql = "select tstamp_gmt, celsius "
			+ "from thermos_vti "
			+ "where "
			+ "thermometer_id = " + sensorID
			+ " and "
			+ "tstamp_gmt >= (cast (\"" + timestamp + "\" as datetime year to fraction(5)) - interval(4.5) second(2) to fraction(1))::datetime year to fraction(5)";
	var recentTemps = connection.querySync(sql);
	console.log("[DATA-PULLED] : Recent Stamps -> ", recentTemps);
	console.log("<------------------------>");
	
	//create JSON object of data to send for analytics and display
	var fullDataObject = {
			"latestTemp"	: latestTemp,
			"averageTemp"	: averageTemp,
			"recentTemp"	: recentTemps};
	
	return fullDataObject;
}

