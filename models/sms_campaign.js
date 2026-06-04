'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {

  class sms_campaign extends Model {

    static associate(models) {

      sms_campaign.hasMany(models.sms_log, {
        foreignKey: 'campaign_id',
        as: 'logs'
      });

      sms_campaign.belongsTo(models.event, {
        foreignKey: 'event_id',
        as: 'event'
      });

    }

  }

  sms_campaign.init({

    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    event_id: {
      type: DataTypes.UUID,
      allowNull: false
    },

    name: DataTypes.STRING,

    type: DataTypes.STRING,

    message_template: DataTypes.TEXT

  }, {

    sequelize,
    modelName: 'sms_campaign',

  });

  return sms_campaign;
};