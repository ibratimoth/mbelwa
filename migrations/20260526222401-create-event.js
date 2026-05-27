'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        allowNull: false,
        primaryKey: true,
      },

      title: {
        type: Sequelize.STRING,
        allowNull: false
      },

      groom_name: {
        type: Sequelize.STRING
      },

      bride_name: {
        type: Sequelize.STRING
      },

      venue: {
        type: Sequelize.STRING
      },

      event_date: {
        type: Sequelize.DATE
      },

      card_template: {
        type: Sequelize.STRING
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },

      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('events');
  }
};