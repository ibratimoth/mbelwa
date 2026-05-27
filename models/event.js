'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {

  class event extends Model {

    static associate(models) {

      // One event has many guests
      event.hasMany(models.guest, {
        foreignKey: 'event_id',
        as: 'guests'
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

    card_template: DataTypes.STRING

  }, {

    sequelize,
    modelName: 'event',

  });

  return event;
};