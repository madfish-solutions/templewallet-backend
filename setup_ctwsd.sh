#!/bin/bash

CONFDIR=/opt/tmp
ESCAPED_CONFDIR=$(echo $CONFDIR | sed 's/\//\\\//g')
DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y wget tar
wget $CTWSD_FTP_URL --user=$CTWSD_FTP_USER --password=$CTWSD_FTP_PASS --no-check-certificate -O ./ctwsd.tar.gz
tar -xzf ctwsd.tar.gz
rm ctwsd.tar.gz
mv ./ctwsd* ./ctwsd

sed -i  "s/ServerAddress \= xxxxxxxxx/ServerAddress = ${CTWSD_SERVER_ADDRESS}/" ./ctwsd/bin/ctwsd.conf
sed -i  "s/LicenseKey \= xxxxxxxxx/LicenseKey = ${CTWSD_LICENSE_KEY}/" ./ctwsd/bin/ctwsd.conf
sed -i  "s/#LocalCustomCategories-Enabled=0/LocalCustomCategories-Enabled=1/" ./ctwsd/bin/ctwsd.conf
sed -i  "s/#CustomCategoriesCacheMaxEntries=10000/CustomCategoriesCacheMaxEntries=10000/" ./ctwsd/bin/ctwsd.conf
sed -i ${sed_mac_arg:+""} \
  "s/#LocalCustomCategories-Uri=/LocalCustomCategories-Uri=${ESCAPED_CONFDIR}\/CustomCategoryIndex.idx/" \
  ./ctwsd/bin/ctwsd.conf
sed -i ${sed_mac_arg:+""} \
  "s/#LocalCustomCategoriesDefinitionFileURI=/LocalCustomCategoriesDefinitionFileURI=${ESCAPED_CONFDIR}\/CustomCategoryDefinition.ini/" \
  ./ctwsd/bin/ctwsd.conf
