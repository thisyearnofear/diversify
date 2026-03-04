#!/bin/bash

# MongoDB Atlas Setup Script for DiversiFi
# This script helps set up MongoDB Atlas cluster, user, and IP access list

echo "Setting up MongoDB Atlas for DiversiFi..."

# Check if atlas CLI is installed
if ! command -v atlas &> /dev/null; then
    echo "MongoDB Atlas CLI is not installed. Please install it first:"
    echo "https://www.mongodb.com/docs/atlas/cli/stable/install-atlas-cli/"
    exit 1
fi

# Check if user is logged in
if ! atlas auth status &> /dev/null; then
    echo "You are not logged in to MongoDB Atlas. Please run:"
    echo "atlas auth login"
    exit 1
fi

echo "✓ MongoDB Atlas CLI is installed and you are logged in"

# Get project ID
PROJECT_ID=$(atlas project list --output json | jq -r '.results[] | select(.name == "Diversifi") | .id')

if [ -z "$PROJECT_ID" ]; then
    echo "Creating new project 'Diversifi'..."
    PROJECT_ID=$(atlas projects create "Diversifi" --output json | jq -r '.id')
    echo "Created project with ID: $PROJECT_ID"
else
    echo "Using existing project with ID: $PROJECT_ID"
fi

# Check if cluster already exists
if atlas clusters describe DiversiFiCluster --projectId $PROJECT_ID &> /dev/null; then
    echo "✓ Cluster 'DiversiFiCluster' already exists"
else
    echo "Creating cluster 'DiversiFiCluster'..."
    atlas clusters create DiversiFiCluster --projectId $PROJECT_ID --provider AWS --region US_EAST_1 --tier M0
    echo "✓ Cluster 'DiversiFiCluster' created"
fi

# Wait for cluster to be ready
echo "Waiting for cluster to be ready..."
atlas clusters watch DiversiFiCluster --projectId $PROJECT_ID

# Check if database user already exists
if atlas dbusers describe diversifi-user --projectId $PROJECT_ID &> /dev/null; then
    echo "✓ Database user 'diversifi-user' already exists"
else
    echo "Creating database user 'diversifi-user'..."
    # Generate a random password
    DB_PASSWORD=$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-12)
    atlas dbusers create readWriteAnyDatabase --username diversifi-user --projectId $PROJECT_ID --password "$DB_PASSWORD"
    echo "✓ Database user 'diversifi-user' created"
    
    # Update .env.local with the new credentials
    if [ -f ".env.local" ]; then
        sed -i.bak "s|MONGODB_URI=.*|MONGODB_URI=mongodb+srv://diversifi-user:$DB_PASSWORD@diversificluster.*\.mongodb\.net/DiversiFiCluster?retryWrites=true&w=majority|" .env.local
        echo "Updated .env.local with new credentials"
    fi
fi

# Check if IP access list already has the entry
ACCESS_LIST_EXISTS=$(atlas accessList list --projectId $PROJECT_ID --output json | jq -r '.results[] | select(.cidrBlock == "0.0.0.0/0") | .cidrBlock' 2>/dev/null)

if [ "$ACCESS_LIST_EXISTS" = "0.0.0.0/0" ]; then
    echo "✓ IP access list already allows all connections"
else
    echo "Adding IP access list entry to allow all connections..."
    atlas accessList create 0.0.0.0/0 --type cidrBlock --projectId $PROJECT_ID --comment "Allow all connections for development"
    echo "✓ IP access list updated"
fi

echo ""
echo "MongoDB Atlas setup complete!"
echo ""
echo "Connection string:"
echo "mongodb+srv://diversifi-user:<password>@diversificluster.*.mongodb.net/DiversiFiCluster?retryWrites=true&w=majority"
echo ""
echo "Make sure your .env.local file has the correct MONGODB_URI"