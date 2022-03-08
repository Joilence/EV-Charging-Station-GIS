
drop table if exists polygons;
CREATE TABLE polygons (
	osm_id int8 NULL,
	"access" text NULL,
	"addr:housename" text NULL,
	"addr:housenumber" text NULL,
	"addr:interpolation" text NULL,
	name text NULL,
	amenity text NULL,
	tags hstore NULL,
	way geometry null
);
insert into polygons
select osm_id,
	"access",
	"addr:housename",
	"addr:housenumber",
	"addr:interpolation",
	name,
	amenity,
	tags,
	way  from planet_osm_polygon 
where amenity in ('bar','bbq','biergarten','cafe','fast_food','food_court','ice_cream','pub','restaurant');


drop table if exists points;
CREATE TABLE points (
	osm_id int8 NULL,
	"access" text NULL,
	"addr:housename" text NULL,
	"addr:housenumber" text NULL,
	"addr:interpolation" text NULL,
	name text NULL,
	amenity text NULL,
	tags hstore NULL,
	way geometry null
);
insert into points
select osm_id,
	"access",
	"addr:housename",
	"addr:housenumber",
	"addr:interpolation",
	name,
	amenity,
	tags,
	way  from planet_osm_point 
where amenity in ('bar','bbq','biergarten','cafe','fast_food','food_court','ice_cream','pub','restaurant');


drop table if exists amenities;

CREATE TABLE amenities (
	osm_id int8 NULL,
	"access" text NULL,
	"addr:housename" text NULL,
	"addr:housenumber" text NULL,
	"addr:interpolation" text NULL,
	name text NULL,
	amenity text NULL,
	tags hstore NULL,
	way geometry null
);

insert into amenities
select osm_id,
	"access",
	"addr:housename",
	"addr:housenumber",
	"addr:interpolation",
	name,
	amenity,
	tags,
	way
from points 
union
select polygons.osm_id,
	polygons."access",
	polygons."addr:housename",
	polygons."addr:housenumber",
	polygons."addr:interpolation",
	polygons.name,
	polygons.amenity,
	polygons.tags,
	st_centroid(polygons.way) as way
from polygons;


DROP TABLE IF EXISTS points;
DROP TABLE IF EXISTS polygons;