'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class guest extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
    }
  }
  guest.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: DataTypes.STRING,
    phone: DataTypes.STRING,
    type: DataTypes.ENUM('single', 'double'),
    card_number: {
      type: DataTypes.INTEGER,
      autoIncrement: true,   
      allowNull: false,
    },
    qr_code_path: DataTypes.STRING,
    scans: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
  }, {
    sequelize,
    modelName: 'guest',
  });
  return guest;
};