# specify base image that we want to extend
FROM kartoza/postgis:13.0

# set environment variables that we want to change
ENV POSTGRES_DBNAME="gis_db"
ENV POSTGRES_USER="gis_user"
ENV POSTGRES_PASS="gis_pass"
ENV POSTGRES_MULTIPLE_EXTENSIONS=postgis,hstore,postgis_topology,postgis_raster,pgrouting

