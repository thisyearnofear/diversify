import mongoose from 'mongoose';

async function testConnection() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  console.log('Testing MongoDB connection...');
  console.log('URI:', uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Mask credentials in output

  try {
    await mongoose.connect(uri);
    console.log('✅ Successfully connected to MongoDB Atlas!');
    
    // Test by checking if we can access the database
    const db = mongoose.connection.db;
    console.log(`✅ Connected to database: ${db.databaseName}`);
    
    // Test collection operations
    const collections = await db.listCollections().toArray();
    console.log(`✅ Found ${collections.length} collections in the database`);
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB Atlas');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB Atlas:', error);
    process.exit(1);
  }
}

testConnection();