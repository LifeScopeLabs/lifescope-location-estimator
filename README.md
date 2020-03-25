# LifeScope Location Estimator

This worker estimates the Location of every LifeScope Event that does not have one.
Whenever a user's data has gone more than a day without being estimated, it gets all of the Events that do not have
Locations or have Locations that are estimated. For each one, it finds two Locations; the Location whose datetime is
closest before the datetime of the Event, and the Location whose datatime is closest after the datetime of the Event.
Whichever Location is closer in time is set as the estimated Location for that Event; in the case that there is only
one Location, e.g. the Event precedes all non-estimated Locations, then the one Location that is known is used.

## Running locally

### Install node_modules
Run npm install or yarn install (npm or yarn must already be installed).

## Create config files
You'll need to create two new files in the config folder called dev.json and production.json.
The gitignore contains these filenames, so there's no chance of accidentally committing them.

These new config files only needs a few lines, because the 'config' library first pulls everything from 'default.json' and then overrides anything that it finds in other config files it uses.
The config files should look like this:

```
{
 "mongodb": {
"address": "<insert address>"
 }
}
```

### Start server
Just run 

```NODE_ENV=dev node --experimental-modules server.js```

This will use the 'dev' configuration, so make sure you've created a dev.json file in the config folder.
dev.json needs to have a Mongo address, AWS credentials, and an S3 bucket name filled in.

## Location of Kubernetes scripts

The following parts of this guide reference Kubernetes/Kustomize configuration scripts. 
These scripts are all located in [a separate repository](https://github.com/lifescopelabs/lifescope-kubernetes).

## Building and running on a local Minikube installation via Kubernetes

### Containerize Location Estimator via Docker and run in a Kubernetes Cluster
The LifeScope Location Estimator can be run in a Kubernetes Cluster via containerizing the code with Docker.

Containerized builds of the codebase can be found on LifeScope Labs' Docker hub, ```lifescopelabs/lifescope-location-estimator:vX.Y.Z```.
If you want to build your own, you have two options: build into Minikube's local Docker registry, or build locally and push
to a Docker Hub you control. 

### 1a. Point shell to Minikube's local Docker registry (optional)

By default, Docker uses a distinct local registry when building images.
Minikube has its own local Docker registry, and by default will pull images from Docker Hub into its registry
before spinning up instances of those images.
You can point your Linux/Mac shell to the Minikube registry so that Docker builds directly into Minikube via the following:
```eval $(minikube -p minikube docker-env)```

If you do this, you can skip the following step and go directly to 'Containerize the API with Docker'.

### 1b. Set up Docker Hub account and install Docker on your machine (optional)
*LifeScope has a Docker Hub account with repositories for images of each of the applications that make up the service.
The Kubernetes scripts are coded to pull specific versions from the official repos.
If you're just pulling the official images, you don't need to set up your own Hub or repositories therein.*

*If you followed the previous section and pointed your shell to Minikube's local Docker registry, definitely skip
this step, as it's completely unnecessary.*

This guide will not cover how to set up a Docker Hub account or a local copy of Docker since the instructions provided 
by the makers of those services are more than sufficient.
Once you've created a Docker Hub account, you'll need to make public repositories for each of the lifescope services you
want to run. At the very least, you'll want to run lifescope-api, lifescope-app, and lifescope-location-estimator and the Docker Hubs for those are 
most easily named ```lifescope-api```and ```lifescope-app```, and ```lifescope-location-estimator```. 
If you use different names, you'll have to change the image names in the Kubernetes config files in the 
lifescope-kubernetes sub-directories for those services.

### 2. Containerize the Location Estimator with Docker (optional)

*LifeScope has a Docker Hub account with repositories for images of each of the applications that make up the service.
The Kubernetes scripts are coded to pull specific versions from the official repos.
If you want to pull from a repo you control, do the following:*

After installing Docker on your machine, from the top level of this application run ```docker build -t <Docker Hub username>/lifescope-location-estimator:vX.Y.Z .```.
X,Y, and Z should be the current version of the Location Estimator, though it's not required that you tag the image with a version.

You'll then need to push this image to Docker Hub so that the Kubernetes deployment can get the proper image.
Within lifescope-kubernetes/lifescope-location-estimator/base/lifescope-location-estimator.yaml, you'll see a few instances of an image name that points to an image name, something along
the lines of lifescopelabs/lifescope-location-estimator:v1.1.0. Each instance of this will need to be changed to <Docker Hub username>/<public repo name>:<version name>.
For example, if your username is 'cookiemonstar' and you're building v4.5.2 of the Location Estimator, you'd change the 'image' field 
wherever it occurs in base/lifescope-location-estimator.yaml to ```cookiemonstar/lifescope-location-estimator:v4.5.2```.
This should match everything following the '-t' in the build command.

Once the image is built, you can push it to Docker Hub by running ```docker push <imagename>```, e.g. ```docker push cookiemonstar/lifescope-location-estimator:v4.5.2```.
If you're using Minikube's Docker registry, skip this push command because Minikube already has the image.
You're now ready to deploy the Location Estimator pod.

### Run Location Estimator Kustomize script

*Before running this, make sure that you have the dev.json file from the config folder in lifescope-kubernetes/lifescope-location-estimator/base*

From the top level of the lifescope-kubernetes repo, run ```kubectl apply -k lifescope-location-estimator/base```.

If this ran properly, you should be able to go to api.dev.lifescope.io/gql-p and see the GraphQL Playground running. 

## Building and running in a cloud production environment

### Install node_modules
Run npm install or yarn install (npm or yarn must already be installed).

### Containerize Location Estimator via Docker and run in a Kubernetes Cluster
The LifeScope Location Estimator can be run in a Kubernetes Cluster via containerizing the code with Docker.

Containerized builds of the codebase can be found on LifeScope Labs' Docker hub, ```lifescopelabs/lifescope-location-estimator:vX.Y.Z```.
If you want to build your own, you will need to build an image locally and push to a Docker Hub you control. 

#### Set up Docker Hub account and install Docker on your machine (optional)
*LifeScope has a Docker Hub account with repositories for images of each of the applications that make up the service.
The Kubernetes scripts are coded to pull specific versions from the official repos.
If you're just pulling the official images, you don't need to set up your own Hub or repositories therein.*

This guide will not cover how to set up a Docker Hub account or a local copy of Docker since the instructions provided 
by the makers of those services are more than sufficient.
Once you've created a Docker Hub account, you'll need to make public repositories for each of the lifescope services you
want to run. At the very least, you'll want to run lifescope-api, lifescope-app, and lifescope-location-estimator and the Docker Hubs for those are 
most easily named ```lifescope-api```and ```lifescope-app```, and ```lifescope-location-estimator```. 
If you use different names, you'll have to change the image names in the Kubernetes config files in the 
lifescope-kubernetes sub-directories for those services.

#### Containerize the Location Estimator with Docker (optional)

*LifeScope has a Docker Hub account with repositories for images of each of the applications that make up the service.
The Kubernetes scripts are coded to pull specific versions from the official repos.
If you want to pull from a repo you control, do the following:*

After installing Docker on your machine, from the top level of this application run ```docker build -t <Docker Hub username>/lifescope-location-estimator:vX.Y.Z .```.
X,Y, and Z should be the current version of the Location Estimator, though it's not required that you tag the image with a version.

You'll then need to push this image to Docker Hub so that the Kubernetes deployment can get the proper image.
Within lifescope-kubernetes/lifescope-location-estimator/overlaye/production/lifescope-location-estimator.yaml, you'll see a few instances of an image name that points to an image name, something along
the lines of lifecsopelabs/lifescope-location-estimator:v1.1.0. Each instance of this will need to be changed to <Docker Hub username>/<public repo name>:<version name>.
For example, if your username is 'cookiemonstar' and you're building v4.5.2 of the Location Estimator, you'd change the 'image' field 
wherever it occurs in lifescope-kubernetes/lifescope-location-estimator/overlays/production/lifescope-location-estimator to ```cookiemonstar/lifescope-location-estimator:v4.5.2```.
This should match everything following the '-t' in the build command.

Once the image is built, you can push it to Docker Hub by running ```docker push <imagename>```, e.g. ```docker push cookiemonstar/lifescope-location-estimator:v4.5.2```.
You're now ready to deploy the Kubernetes cluster.

### Deploy Kubernetes cluster and Location Estimator pod
This guide is copied almost verbatim in lifescope-app and lifescope-api, so if you've already set up either of those, you can skip straight to
running the lifescope-location-estimator Kustomize script.

#### Install eksctl and create Fargate cluster
Refer to [this guide](https://docs.aws.amazon.com/eks/latest/userguide/getting-started-eksctl.html) for how to set up
eksctl.

The script to provision the Fargate cluster is located in the lifescope-kubernetes repo.
To provision the Fargate cluster, from the top level of lifescope-kubernetes run ```eksctl create cluster -f aws-fargate/production/aws-cluster.yaml```.

#### Run Location Estimator Kustomize script

*Before running this, make sure that you have the dev.json file from the config folder in lifescope-kubernetes/lifescope-location-estimator/base
and the production.json file from the config folder in lifescope-kubernetes/lifescope-location-estimator/overlays/production.
dev.json won't be used, but due to a deficiency in Kustomize as of writing this it's impossible to tell it to ignore the 
base instruction of secretizing dev.json.*

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