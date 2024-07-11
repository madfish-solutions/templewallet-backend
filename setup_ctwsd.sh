#!/bin/bash

CC_CONFDIR=/usr/src/app
ESCAPED_CC_CONFDIR=$(echo $CC_CONFDIR | sed 's/\//\\\//g')
DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y wget
wget $CTWSD_FTP_URL --user=$CTWSD_FTP_USER --password=$CTWSD_FTP_PASS --no-check-certificate -O ./ctwsd.tar.gz
tar -xzf ctwsd.tar.gz
rm ctwsd.tar.gz
mv ./ctwsd* ./ctwsd

CONF_FILE_PATH=./ctwsd/bin/ctwsd.conf
CC_CACHE_MAX_ENTRIES=10000
sed -i  "s/ServerAddress \= xxxxxxxxx/ServerAddress = ${CTWSD_SERVER_ADDRESS}/" $CONF_FILE_PATH
sed -i  "s/LicenseKey \= xxxxxxxxx/LicenseKey = ${CTWSD_LICENSE_KEY}/" $CONF_FILE_PATH
sed -i  "s/#LocalCustomCategories-Enabled=0/LocalCustomCategories-Enabled=1/" $CONF_FILE_PATH
sed -i  "s/#CustomCategoriesCacheMaxEntries=10000/CustomCategoriesCacheMaxEntries=${CC_CACHE_MAX_ENTRIES}/" \
  $CONF_FILE_PATH
sed -i  "s/#LocalCustomCategories-Uri=/LocalCustomCategories-Uri=${ESCAPED_CC_CONFDIR}\/CustomCategoryIndex.idx/" \
  $CONF_FILE_PATH
sed -i  "s/#LocalCustomCategoriesDefinitionFileURI=/LocalCustomCategoriesDefinitionFileURI=\
${ESCAPED_CC_CONFDIR}\/CustomCategoryDefinition.ini/" $CONF_FILE_PATH
