'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add column as nullable first to prevent FK violation on existing rows
    await queryInterface.addColumn('events', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    // 2. Optional: If you have an existing user ID, you can assign old events to that user
    // await queryInterface.sequelize.query(
    //   `UPDATE "events" SET "user_id" = 'YOUR_EXISTING_USER_UUID' WHERE "user_id" IS NULL;`
    // );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('events', 'user_id');
  }
};