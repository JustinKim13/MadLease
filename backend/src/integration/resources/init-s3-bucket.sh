#!/bin/bash

BUCKET=apartment-pictures-s3-bucket

# needed for local stack to work  - dummy credentials for AWS CLI
export AWS_ACCESS_KEY_ID=dummy  
export AWS_SECRET_ACCESS_KEY=dummy

echo $(awslocal s3 mb s3://$BUCKET)

echo "Uploading images"
echo $(pwd)
awslocal s3 sync /etc/localstack/init/ready.d/images/ s3://apartment-pictures-s3-bucket/

echo $(awslocal s3 ls)

echo "Applying CORS policy to bucket ${BUCKET}"
awslocal s3api put-bucket-cors \
  --bucket $BUCKET \
  --cors-configuration '{
    "CORSRules":[
      {
        "AllowedOrigins":["http://localhost:5173"],
        "AllowedMethods":["PUT","POST","GET","HEAD"],
        "AllowedHeaders":["*"],
        "ExposeHeaders":["ETag"],
        "MaxAgeSeconds":3000
      }
    ]
  }'