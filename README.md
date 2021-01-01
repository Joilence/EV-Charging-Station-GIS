# EV Charging Station GIS

A project for GIS lecture, Uni Konstanz.

This is a GIS application that supports the exploration of EV charging stations in Germany. The EV charging stations are rated by surrounding facilities. 

# Motivation

- EV is becoming popular
- The time for charging an EV is significantly longer than refueling a normal car
- Thus, drivers might need to spend some time around, e.g., a cup of coffee in a Café. (No alcohol!)

# Datasets

- [Ladesäulen in Deutschland | Esri Deutschland Open Data Portal](https://opendata-esri-de.opendata.arcgis.com/datasets/esri-de-content::lades%C3%A4ulen-in-deutschland)
- [Michelin Restaurant scores]()
- [OpenStreetMap Germany](https://download.geofabrik.de/europe/germany-latest.osm.pbf)

NOTE: OSM data must be manually loaded on the database. You can use [osm2pgsql](https://osm2pgsql.org) to perform this operation.
On Windows 
```bash
.\osm2pgsql.exe --database gis_db --host localhost --port 25432 --username gis_user --password --create --slim --drop --latlong --hstore-all germany-latest.osm.pbf
```





# Systems
- Database: PostGIS
- Backend: Python + Flask
- Frontend: Javascript + Angular

Architecture is running in a Docker Container.


# Prerequisites

As our system relies on [OpenRouteService](https://openrouteservice.org/), we highly recommend to first download the precomputed graphs [here](https://1drv.ms/u/s!AoQ6UBA4h5Orx2jz_8cQIn9gOikl?e=79fJgR).
Remark: If you do not want to download the precomputed graph, you have to manually download the evaluation data for your specified area in the .pbf file
from [here](https://srtm.csi.cgiar.org/srtmdata/). 

After downloading the zip file from the OneDrive, extract it in the ```/ors``` directory in the root folder of the project. The ```/ors``` directory should
now include 4 folders and one .pbf file. Now you are able to start the docker container!

More information on ORS can be found [here](https://github.com/GIScience/openrouteservice). Details on the API is provided
[here](https://openrouteservice.org/dev/#/api-docs).
# Execution
- Start the docker containers with the following command
```bash
docker-compose up
```

Wait some time for the initializaton (around 1-3 minutes).

- If your system is ready, the following GET request should return 'ready':
http://localhost:8080/ors/v2/health
- In addition, the health endpoint should provide some more information about the running ORS service:
http://localhost:8080/ors/v2/status
- Lastly, the following endpoint should return a valid route:
http://localhost:8080/ors/v2/directions/driving-car?start=9.011155,47.818380&end=10.499955,53.884399
- If all the checks succeed, your system is ready.

- Open localhost:4200 for some nice frontend interaction. 
