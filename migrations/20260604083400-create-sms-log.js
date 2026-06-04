'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.createTable('sms_logs', {

      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },

      campaign_id: {
        type: Sequelize.UUID,
        allowNull: false
      },

      event_id: {
        type: Sequelize.UUID,
        allowNull: false
      },

      guest_id: {
        type: Sequelize.UUID,
        allowNull: true
      },

      phone: {
        type: Sequelize.STRING,
        allowNull: false
      },

      reference_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },

      provider_message_id: {
        type: Sequelize.STRING
      },

      status: {
        type: Sequelize.STRING,
        defaultValue: 'PENDING'
      },

      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },

      provider_response: {
        type: Sequelize.JSON
      },

      retry_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },

      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },

      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    // 🔒 extra safety (optional but recommended)
    await queryInterface.addConstraint('sms_logs', {
      fields: ['campaign_id', 'guest_id'],
      type: 'unique',
      name: 'unique_campaign_guest_sms'
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sms_logs');
  }
};