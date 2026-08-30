'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {

  class event extends Model {

    static associate(models) {

      // Belongs to a User
      event.belongsTo(models.user, {
        foreignKey: 'user_id',
        as: 'user'
      });

      // One event has many guests
      event.hasMany(models.guest, {
        foreignKey: 'event_id',
        as: 'guests'
      });

      event.hasMany(models.sms_campaign, {
        foreignKey: 'event_id',
        as: 'sms_campaigns'
      });

    }
  }

  event.init({

    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    title: DataTypes.STRING,

    groom_name: DataTypes.STRING,

    bride_name: DataTypes.STRING,

    venue: DataTypes.STRING,

    event_date: DataTypes.DATE,

    card_template: DataTypes.STRING,

    layout_config: DataTypes.JSON,

    scanner_token: DataTypes.STRING,

    user_id: {
      type: DataTypes.UUID, // Matched to match migration UUID type
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }

  }, {

    sequelize,
    modelName: 'event',

  });

  return event;
};