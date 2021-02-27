# GIS: Advanced Route Planning of Electric Vehicles based on Charging Stations

A project for GIS lecture, Uni Konstanz, winter term 2020/2021.

This is a GIS application that supports the exploration of Electric Vehicles (EV) charging stations in Germany. The EV charging stations are rated by surrounding facilities. 

# Motivation

- EV is becoming popular.
- The time for charging an EV is significantly longer than refueling a normal car.
- Thus, drivers might need to spend some time around, e.g., a cup of coffee in a Café. (No alcohol!)

# Datasets

- [Ladesäulen in Deutschland | Esri Deutschland Open Data Portal](https://opendata-esri-de.opendata.arcgis.com/datasets/esri-de-content::lades%C3%A4ulen-in-deutschland)
- [Michelin Restaurant scores](https://github.com/danmuf/michelin-stars-restaurants-api)
- [OpenStreetMap Germany](https://download.geofabrik.de/europe/germany-latest.osm.pbf)

NOTE: We provide preprocessed data to minimize setup time (see setup section). Nevertheless, if you have time and a good machine you can import the OSM data by yourself and perform the necessary preprocessing by yourself. Therefore, OSM data must be manually loaded on the database. You can use [osm2pgsql](https://osm2pgsql.org) to perform this operation.
On Windows 
```bash
.\osm2pgsql.exe --database gis_db --host localhost --port 25432 --username gis_user --password --create --slim --drop --latlong --hstore-all germany-latest.osm.pbf
```

Afterwards, execute the SQL script from [here](./assets/amenities.sql) in your database.


# Systems
- Database: PostgreSQL with extension PostGIS
- Backend: Python + Flask
- Frontend: TypeScript + Angular

Architecture is wrapped in a Docker Container.


# Setup

The following section describes the process of setting up the system from scratch. Read the following very carefully and execute each of the necessary steps.

## Prerequisites

NOTE: Running this system requires at least 7GB of RAM.

- As our system relies on [OpenRouteService](https://openrouteservice.org/), we highly recommend to first download the precomputed graphs [here](https://drive.google.com/file/d/1biagbMU_D_mvA9sNLpiA3cLz1gfXsGde/view?usp=sharing).
Remark: If you do not want to download the precomputed graphs, you have to manually download the evaluation data for your specified area in the .pbf file
from [here](https://srtm.csi.cgiar.org/srtmdata/). 
- More information on ORS can be found [here](https://github.com/GIScience/openrouteservice). Details on the API is provided
[here](https://openrouteservice.org/dev/#/api-docs).
- We recommend DBeaver (https://dbeaver.io/) as a database tool to connect with our database.
- Make sure to have Docker installed and running: https://www.docker.com/get-started
- Please make sure that the ports we use for our systems are free. The used ports can be seen in in the ``docker-compose.yml`` [here](./docker-compose.yml).
- For this setup guide, we assume the following:
	- Download of the precomputed graphs for ORS (as mentioned above): https://drive.google.com/file/d/1biagbMU_D_mvA9sNLpiA3cLz1gfXsGde/view?usp=sharing
	- Download the SQL dump for amenities: https://drive.google.com/file/d/14NlYXJ1h5zXkNO598dTR_cwsEchgs4zr/view?usp=sharing


## Installation

- Clone this repository locally.
- Extract the ``ors.zip`` file (you downloaded in the previous steps) in the ```./ors``` directory in the root folder of the cloned project. The ```./ors``` directory should
now include 4 folders and one .pbf file. 
- Run ``docker-compose build`` in the project's root folder to build the images.
- Run ``docker-compose up database`` to start database container to import data.
- Now, connect to the database (should be on ``localhost:25432``) started before. To do so, follow the guide for DBeaver: https://dbeaver.com/docs/wiki/Connect-to-Database/. Database information:

	``ENV POSTGRES_DBNAME="gis_db"``

	``ENV POSTGRES_USER="gis_user"``

	``ENV POSTGRES_PASS="gis_pass"``

- Then, use the downloaded SQL dump ``dump-gis_db.sql`` and import it in our database. You may follow the instructions provided here: https://dbeaver.io/forum/viewtopic.php?f=2&t=895.
- After importing the SQL dump, everything should be ready and you can stop the database container. Further checks and startup information can be found below.

## Startup
- Start the docker containers with the following command
```bash
docker-compose up
```

- For first startup:
	- After all the containers are started (around 3 minutes for the first time), the OpenRouteService has to read the correct configuration file.
	- Stop the container and all services after full startup.
	- Run ``docker-compose up`` again to start the container.

Wait some time for the initializaton (around 1-3 minutes).

- If your system is ready, the following GET request should return 'ready':
http://localhost:8080/ors/v2/health
- In addition, the health endpoint should provide some more information about the running ORS service:
http://localhost:8080/ors/v2/status
- Lastly, the following endpoint should return a valid route:
http://localhost:8080/ors/v2/directions/driving-car?start=9.011155,47.818380&end=10.499955,53.884399
- If all the checks succeed, your system is ready.

- Open http://localhost:4200 for some nice frontend interaction. 


# Report

The report of the project can be found [here](./assets/gis_report.pdf).

# Troubleshooting

If you have problem installing or setting up something, don't hesitate to contact us (firstname.lastname@uni-konstanz.de).

