'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.addColumn(
      'sms_logs',
      'reference_id',
      {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      }
    );

  },

  async down(queryInterface) {

    await queryInterface.removeColumn(
      'sms_logs',
      'reference_id'
    );

  }
};