 require('dotenv').config();
const env = process.env.NODE_ENV || 'development';
 module.exports =
{
  development: {
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'Timoth!',
    database: process.env.DB_NAME || 'wedding_db',
    host: process.env.DB_HOST || 'localhost',
    dialect: 'postgres',
    seederStorage: 'sequelize',
    seederStorageTableName: 'SequelizeData'
  }
};
