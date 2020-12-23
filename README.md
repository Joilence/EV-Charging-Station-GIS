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

Architecture is running in a Docker Container


# Execution
- Start the docker containers with the following command
```bash
docker-compose up
```

- Make sure to load the OSM data for germany into the database (can take very long)
- Connect to localhost:4200 
