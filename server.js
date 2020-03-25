import _ from 'lodash';
import config from 'config';
import moment from 'moment';
import mongodb from 'mongodb';

import uuid from './lib/util/uuid.js';

let mongo;


async function dequeue() {
	let user = await mongo.db('live').collection('users').findOne({
		location_estimation_status: 'ready',
		$or: [
			{
				last_location_estimation: {
					$lte: moment().utc().subtract(1, 'day').toDate()
				}
			},
			{
				last_location_estimation: {
					$exists: false
				}
			}
		]
	}, {
		sort: {
			last_location_estimation: 1
		}
	});

	if (user == null) {
		console.log('No users for whom to estimate locations, pausing for 5 minutes');
		
		setTimeout(dequeue, 300000);
	}
	else {
		console.log('Estimating locations for user ' + user._id.toString('hex'));

		try {
			let bulkEvents = mongo.db('live').collection('events').initializeUnorderedBulkOp();
			let bulkLocations = mongo.db('live').collection('locations').initializeUnorderedBulkOp();

			let promises = [];

			await mongo.db('live').collection('users').updateOne({
				_id: user._id
			}, {
				$set: {
					location_estimation_status: 'running'
				}
			});

			let eventResult = await mongo.db('live').collection('events').aggregate([
				{
					$match: {
						user_id: user._id
					}
				},
				{
					$lookup: {
						from: 'locations',
						localField: 'location',
						foreignField: '_id',
						as: 'hydratedLocation'
					}
				},
				{
					$unwind: {
						path: '$hydratedLocation',
						preserveNullAndEmptyArrays: true
					}
				}
			]).toArray();

			console.log('Events: ' + eventResult.length);

			let startTime = moment();

			_.each(eventResult, async function(event) {
				if (event.hydratedLocation == null || event.hydratedLocation.estimated === true) {
					let _id = event.location ? event.location : uuid(uuid());
					let datetime = event.datetime || event.created;

					let promise = Promise.all([
						mongo.db('live').collection('locations').findOne({
							estimated: false,
							datetime: {
								$lte: datetime
							},
							user_id: user._id
						}, {
							sort: {
								datetime: -1
							}
						}),

						mongo.db('live').collection('locations').findOne({
							estimated: false,
							datetime: {
								$gte: datetime
							},
							user_id: user._id
						}, {
							sort: {
								datetime: 1
							}
						}),
					]);

					promises.push(promise);

					let [priorLocation, nextLocation] = await promise;

					let priorMoment = moment(priorLocation).utc();
					let nextMoment = moment(nextLocation).utc();
					let eventMoment = moment(datetime);
					let priorDiff = Math.abs(priorMoment - eventMoment);
					let nextDiff = Math.abs(nextMoment - eventMoment);

					let estimatedLocation = priorLocation == null ? nextLocation : nextLocation == null ? priorLocation : priorDiff < nextDiff ? priorLocation : nextLocation;

					if (estimatedLocation != null) {
						let newLocation = {
							identifier: 'estimated:::' + event._id.toString('hex') + ':::' + moment(datetime).utc().toJSON(),
							estimated: true,
							datetime: moment(datetime).utc().toDate(),
							geo_format: 'lat_lng',
							geolocation: estimatedLocation.geolocation,
							tracked: false,
							updated: moment().utc().toDate()
						};

						bulkLocations.find({
							$or: [
								{
									_id: _id
								},
								{
									identifier: newLocation.identifier
								},
							],
							user_id: user._id
						})
							.upsert()
							.updateOne({
								$set: newLocation,
								$setOnInsert: {
									_id: _id,
									created: moment().utc().toDate()
								}
							});

						if (bulkLocations.s.currentIndex >= 500) {
							promises.push(bulkLocations.execute());

							bulkLocations = mongo.db('live').collection('locations').initializeUnorderedBulkOp();
						}

						if (event.location == null) {
							bulkEvents.find({
								identifier: event.identifier,
								user_id: user._id
							})
								.upsert()
								.updateOne({
									$set: {
										location: _id
									}
								});

							if (bulkEvents.s.currentIndex >= 500) {
								promises.push(bulkEvents.execute());

								bulkEvents = mongo.db('live').collection('events').initializeUnorderedBulkOp();
							}
						}
					}
				}
			});

			if (bulkLocations.s.currentIndex > 0) {
				promises.push(bulkLocations.execute());
			}

			if (bulkEvents.s.currentIndex > 0) {
				promises.push(bulkEvents.execute());
			}

			await new Promise(async function(resolve, reject) {
				try {
					await Promise.all(promises);

					let endTime = moment();

					console.log('Total processing time: ' + endTime.diff(startTime, 'seconds') + ' seconds');


					console.log('Updating user last_location_estimation');

					await mongo.db('live').collection('users').updateOne({
						_id: user._id
					}, {
						$set: {
							location_estimation_status: 'ready',
							last_location_estimation: moment().utc().toDate()
						}
					});

					resolve();
				} catch(err) {
					console.log(err);

					reject(err);
				}
			});

			dequeue();
		} catch(err) {
			console.log('UNSUCCESSFUL');
			console.log(err);

			await mongo.db('live').collection('users').updateOne({
				_id: user._id
			}, {
				$set: {
					location_estimation_status: 'ready'
				}
			});
			
			dequeue();
		}
	}
}



(async function() {
	try {
		mongo = await mongodb.MongoClient.connect(config.mongodb.address, config.mongodb.options);

		await mongo.db('live').collection('users').updateMany({}, {
			$set: {
				location_estimation_status: 'ready'
			}
		});

		//Randomize the start time so that multiple threads don't all simultaneously grab the same job on boot.
		let waitTime = Math.random() * 10000;

		setTimeout(dequeue, waitTime);
	} catch(err) {
		console.log('Couldn\'t start server: ');
		console.log(err);
	}
})();