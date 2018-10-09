# LifeScope Location Estimator

This worker acts on user-uploaded Location JSON files that have been generated from a service such as Google Takeout.
It downloads those files from an S3 bucket, then parses each location and adds it to a bulk Mongo write operation.
This operation creates or updates LifeScope Locations for that datetime.
The operation is split into chunks so that a single point of failure does not kill the upload of every Location.
When the file is fully processed and uploaded, the file is deleted.

## Running locally
Just run 

```npm run start```

This will use the 'dev' configuration, so make sure you've created a dev.json file in the config folder.
dev.json needs to have a Mongo address, AWS credentials, and an S3 bucket name filled in.

## Running in production using pm2
Spin up an EC2 instance. A t3.medium is recommended.

If this is a production environment, you should probably have a separate 'production.json' file in the config folder
with a different Mongo address and/or S3 settings than what's in 'dev.json'.
Make sure to do this before the following steps.

On your local machine run

```npm run build && gulp bundle:ebs```

to package up this worker's files into a zip file.
Then scp those files over to the EC2 instance via

```scp dist/lifescope-location-estimator-ebs-<version>.zip ec2-user@<EC2 instance's public IP>:~```

ssh into the EC2 instance via

```ssh ec2-user@<EC2 public IP>```

Point the box to the Node.js repo via

```curl --silent --location https://rpm.nodesource.com/setup_10.x | sudo bash -```

then install it by entering

```sudo yum install -y nodejs```

Install PM2 globally via

```sudo npm install -g pm2```

Unzip the package by entering

```unzip lifescope-location-estimator-ebs-<version>.zip```

Install the worker's dependencies via

```npm install```

Finally, start up PM2

```pm2 start config/pm2.config.json --env <environment name>```

If this is a production environment use the environment name 'production'.
By default the PM2 config will use the 'dev' configuration.

The PM2 process name for this worker is 'location-estimator'.
The configuration runs PM2 in cluster mode, which will spin up a copy of server.js on multiple cores.
The config additionally indicates that PM2 should do this on every core.

Some other useful PM2 commands are

```
pm2 kill
pm2 restart location-estimator
pm2 stop location-estimator
```