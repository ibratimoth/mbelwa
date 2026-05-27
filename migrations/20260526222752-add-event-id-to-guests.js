'use strict';

module.exports = {

  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn('guests', 'event_id', {

      type: Sequelize.UUID,

      allowNull: false,

      references: {
        model: 'events',
        key: 'id'
      },

      onUpdate: 'CASCADE',

      onDelete: 'CASCADE'

    });

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn('guests', 'event_id');

  }

};