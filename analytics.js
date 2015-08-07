exports.analyze = function(socket, data) {

	/*
	 * You can implement your analytics in this file.
	 */

	console.log(" ----- Analytics ----- ");

	function getRecentSlope() {

		var timeElementsBase;
		var timeElementsIncrement;
		var tempBase;
		var tempIncrement;
		var dateBase;
		var dateIncrement;
		var deltaTemp;
		var deltaTime;
		var slopeArray = [];
		var slopeArrayLength = 0;
		var sum = 0;

		if (data.recentTemp.length > 2) {
			for (var i = 0; i < data.recentTemp.length - 1; i++) {
				//parse the timestamp from Informix and create a date object to manipulate
				timeElementsBase = data.recentTemp[i].tstamp_gmt.split(/[\s-:.]+/);
				timeElementsIncrement = data.recentTemp[i + 1].tstamp_gmt.split(/[\s-:.]+/);
				
				dateBase = new Date(timeElementsBase[0], timeElementsBase[1],
						timeElementsBase[2], timeElementsBase[3],
						timeElementsBase[4], timeElementsBase[5],
						timeElementsBase[6]);
				dateIncrement = new Date(timeElementsIncrement[0],
						timeElementsIncrement[1], timeElementsIncrement[2],
						timeElementsIncrement[3], timeElementsIncrement[4],
						timeElementsIncrement[5], timeElementsIncrement[6]);

				tempBase = data.recentTemp[i].celsius;
				tempIncrement = data.recentTemp[i + 1].celsius;

				deltaTemp = tempIncrement - tempBase;
				deltaTime = (dateIncrement.getTime() - dateBase.getTime()) / 10000; //convert time unit from milliseconds to seconds

				slopeArray.push(deltaTemp / deltaTime); //slope at an instance
			}

			slopeArrayLength = slopeArray.length;
			for (var i = 0; i < slopeArrayLength; i++) {
				sum += slopeArray[i];
			}

			safetyCheck(sum / slopeArrayLength);

		} else {
			console.log("[ERROR] : Need more data to perform analytics.");
			socket.emit('need-more-data');
			console.log("<------------------------>");
		}
	}

	function safetyCheck(recentSlope) {
		/*
		 * If the current temperature and predicted temperature is between the threshold of allowed values,
		 * the status bar will be green and will be considered 'safe' data
		 * 
		 * If the current temperature and predicted temperature is above/below the threshold of allowed values,
		 * the status bar will be red and will be considered 'dangerous' data
		 * 
		 * Any other combination (current temperature is outside thresholds, but trending to a value inside the thresholds, etc.),
		 * the status bar will be yellow and considered 'warning' data
		 */
		var currentTemp = data.latestTemp[0].celsius;
		var highestTempAllowed = 5;
		var lowestTempAllowed = 0;
		var predictedTemp = currentTemp + (recentSlope * 4.0);

		console.log("[CURRENT TEMP] : ", currentTemp);
		console.log("[PREDICTED TEMP] : ", predictedTemp);
		
		if ((currentTemp < highestTempAllowed && currentTemp > lowestTempAllowed)
				&& (predictedTemp < highestTempAllowed && predictedTemp > lowestTempAllowed)) {
			socket.emit('safe');
			console.log("[CURRENT STATUS] : SAFE");
		} else if ((currentTemp > highestTempAllowed || currentTemp < lowestTempAllowed)
				&& (predictedTemp > highestTempAllowed || predictedTemp < lowestTempAllowed)) {
			socket.emit('danger');
			console.log("[CURRENT STATUS] : DANGER");
		} else {
			socket.emit('warning');
			console.log("[CURRENT STATUS] : WARNING");
		}
		
		console.log("<------------------------>");
	}
	
	getRecentSlope();
}