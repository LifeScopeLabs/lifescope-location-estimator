# LifeScope Location Estimator

This worker acts on user-uploaded Location JSON files that have been generated from a service such as Google Takeout.
It downloads those files from an S3 bucket, then parses each location and adds it to a bulk Mongo write operation.
This operation creates or updates LifeScope Locations for that datetime.
The operation is split into chunks so that a single point of failure does not kill the upload of every Location.
When the file is fully processed and uploaded, the file is deleted.

## Running locally
Just run 

```NODE_ENV=dev node --experimental-modules server.js```

This will use the 'dev' configuration, so make sure you've created a dev.json file in the config folder.
dev.json needs to have a Mongo address, AWS credentials, and an S3 bucket name filled in.

## Building and running LifeScope location estimator in a cloud production environment
Once you have a MongoDB cluster running and have set up a BitScoop account, created maps for all of the services, and saved the credentials for that service in its respective Map, you have everything you need to run the API.
The API server was designed to be uploaded and run via Kubernetes. To date it has only been tested on AWS' Elastic Kubernetes Service (and locally on minikube).
All further instructions will assume AWS technologies since we can speak to them; using another cloud provider should
work similarly, just with appropriate deviations to account for how Google/Microsoft/etc. clouds work in practice. 

## Location of Kubernetes scripts

This guide references Kubernetes/Kustomize configuration scripts. 
These scripts are all located in [a separate repository](https://github.com/lifescopelabs/lifescope-kubernetes).

## Create config file
You'll need to create a new file in the config folder called production.json.
The gitignore contains this filename, so there's no chance of accidentally committing it.

This new config file only needs a few lines, because the 'config' library first pulls everything from 'default.json' and then overrides anything that it finds in other config files it uses.
The config file should look like this:

```
{
 "mongodb": {
"address": "<insert address>"
 }
}
```

## Obtain SSL certificate
IF you want your server to be secure, you'll need to purchase a domain name and then register the domain or subdomain(s) 
that you want to use for LifeScope with Amazon Certificate Manager.

When you have the certificate from ACM, make note of its ARN.
Look in the production Nginx config for the Service that will be set up.
Look for the field metadata -> annotations -> service.beta.kubernetes.io/aws-load-balancer-ssl-cert
You will need to replace the value here with the ARN of the certificate you generated.

## Install node_modules
Run npm install or yarn install (npm or yarn must already be installed).

## Run migrations
NOTE: If you've already done this while setting up the app, you can skip this entire step here.

You'll need to run the two migrations in the migrations folder via 'NODE_ENV=production node --experimental-modules migrations/<name>.js'.
The first migration creates indices on each collection that LifeScope stores in the database.
The second loads the LifeScope Providers into the database. 
Make sure that you've replaced the remote_map_id's in the Providers with the BitScoop Map IDs you've created.


#Set up DockerHub account, containerize location estimator via Docker, and run in a Kubernetes Cluster
The LifeScope location estimator can be run in a Kubernetes Cluster via containerizing the code with Docker and uploading the image to DockerHub.

## Set up DockerHub account and install Docker on your machine (optional)
*LifeScope has a Docker Hub account with repositories for images of each of the applications that make up the service.
The Kubernetes scripts are coded to pull specific versions from the official repos.
If you're just pulling the official images, you don't need to set up your own Hub or repositories therein.*

This guide will not cover how to set up a DockerHub account or a local copy of Docker since the instructions provided 
by the makers of those services are more than sufficient.
Once you've created a DockerHub account, you'll need to make public repositories for each of the lifescope services you
want to run. At the very least, you'll want to run lifescope-api, lifescope-app, and lifescope-location-estimator and the Docker Hubs for those are 
most easily named ```lifescope-api```and ```lifescope-app```, and ```lifescope-location-estimator```. 
If you use different names, you'll have to change the image names in the Kubernetes config files in the 
lifescope-kubernetes sub-directories for those services.

## Containerize the location estimator with Docker (optional)

*LifeScope has a Docker Hub account with repositories for images of each of the applications that make up the service.
The Kubernetes scripts are coded to pull specific versions from the official repos.
If you want to pull from a repo you control, do the following:*

After installing Docker on your machine, from the top level of this application run ```docker build -t <DockerHub username>/lifescope-location-estimator:vX.Y.Z .```.
X,Y, and Z should be the current version of the location estimator, though it's not required that you tag the image with a version.

You'll then need to push this image to DockerHub so that the Kubernetes deployment can get the proper image.
Within lifescope-kubernetes/lifescope-location-estimator/overlaye/production/lifescope-location-estimator.yaml, you'll see a few instances of an image name that points to an image name, something along
the lines of lifecsopelabs/lifescope-location-estimator:v1.1.0. Each instance of this will need to be changed to <DockerHub username>/<public repo name>:<version name>.
For example, if your username is 'cookiemonstar' and you're building v4.5.2 of the location estimator, you'd change the 'image' field 
wherever it occurs in lifescope-kubernetes/lifescope-location-estimator/overlays/production/lifescope-location-estimator to ```cookiemonstar/lifescope-location-estimator:v4.5.2```.
This should match everything following the '-t' in the build command.

Once the image is built, you can push it to DockerHub by running ```docker push <imagename>```, e.g. ```docker push cookiemonstar/lifescope-location-estimator:v4.5.2```.
You're now ready to deploy the Kubernetes cluster.

## Deploy Kubernetes cluster
This guide is copied almost verbatim in lifescope-app and lifescope-api, so if you've already set up either of those, you can skip straight to
running the lifescope-location-estimator script.

### Install eksctl and create Fargate cluster
Refer to [this guide](https://docs.aws.amazon.com/eks/latest/userguide/getting-started-eksctl.html) for how to set up
eksctl.

The script to provision the Fargate cluster is located in the lifescope-kubernetes repo.
To provision the Fargate cluster, from the top level of lifescope-kubernetes run ```eksctl create cluster -f aws-fargate/production/aws-cluster.yaml```.

### Run Nginx Kustomize config and provision DNS routing to Load Balancer

From the top level of the lifescope-kubernetes repo, run ```kubectl apply -k lifescope-nginx/overlays/production```.
This will install nginx in your K8s cluster. After a minute or so the Load Balancer that is set up will have provisioned
an external IP, which you can get by running ```kubectl get service -n nginx-ingress``` and looking in the column 'EXTERNAL-IP'.

This external IP will need to be used in a few places.

First, go to [AWS Route53 -> Hosted zones](https://console.aws.amazon.com/route53/home?#hosted-zones:).
Create a Hosted Zone for the top-level domain you're using.
Within that, create a Record Set. The Name can be left blank, Type should be 'A - IPv4 address', set Alias to 'Yes',
and under Alias Target enter 'dualstack.<external-IP>' (if you click on the text box for Alias Target, a prompt scrollable box
should pop up with various resources you have in AWS; the Load Balancer for Nginx should be under 'ELB Classic load balancers'
and if clicked on it should autocomplete everything properly). Click Create when this is all entered.

Next, you'll need to make CNAMEs with your domain registrar from 'app', 'api', and any other lifescope services you're
setting up (embed, xr, nxr) to the external IP.

### Run location estimator Kustomize script

*Before running this, make sure that you have the production.json file from the config folder in lifescope-kubernetes/lifescope-location-estimator/overlays/production
(or dev.json in lifescope-kubernetes/lifescope-location-estimator/base if you're setting up a staging environment)*

From the top level of the lifescope-kubernetes repo, run ```kubectl apply -k lifescope-location-estimator/overlays/production```.

There's no external way to see if this worked since the server doesn't communicate to the outside world, but you can run

```kubectl get pods -A``` 

to see all of the running pods and look for one named 'lifescope-location-estimator-<random characters>-<more random characters>'.

20 seconds or so post-startup its status should be 'Running' and the Ready status should be '1/1'.


## Running in production using pm2 (Deprecated)
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