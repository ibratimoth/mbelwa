'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {

  class sms_log extends Model {

    static associate(models) {

      sms_log.belongsTo(models.sms_campaign, {
        foreignKey: 'campaign_id',
        as: 'campaign'
      });

      sms_log.belongsTo(models.event, {
        foreignKey: 'event_id',
        as: 'event'
      });

      sms_log.belongsTo(models.guest, {
        foreignKey: 'guest_id',
        as: 'guest'
      });

    }

  }

  sms_log.init({

    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    campaign_id: {
      type: DataTypes.UUID,
      allowNull: false
    },

    event_id: {
      type: DataTypes.UUID,
      allowNull: false
    },

    guest_id: {
      type: DataTypes.UUID,
      allowNull: true
    },

    phone: DataTypes.STRING,

    provider_message_id: DataTypes.STRING,
    
    reference_id: DataTypes.STRING,

    status: {
      type: DataTypes.STRING,
      defaultValue: 'PENDING'
    },

    message: DataTypes.TEXT,

    provider_response: DataTypes.JSON

  }, {

    sequelize,
    modelName: 'sms_log',

  });

  return sms_log;
};