'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(
      'events',
      'scanner_token',
      {
        type: Sequelize.STRING,
        allowNull: true
      }
    );

  },

  async down(queryInterface, Sequelize) {

    await queryInterface.removeColumn(
      'events',
      'scanner_token'
    );

  }
};