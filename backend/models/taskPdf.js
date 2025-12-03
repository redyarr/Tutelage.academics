module.exports = (sequelize, DataTypes) => {
  const TaskPdf = sequelize.define(
    'TaskPdf',
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      resourceType: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      resourceId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      filePath: {
        type: DataTypes.STRING(1000),
        allowNull: false
      },
      fileName: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      uploadDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      fileSize: {
        type: DataTypes.INTEGER,
        allowNull: true
      }
    },
    {
      tableName: 'task_pdfs'
    }
  );

  TaskPdf.associate = (models) => {
    TaskPdf.belongsTo(models.Video, { foreignKey: 'resourceId', constraints: false });
    TaskPdf.belongsTo(models.Audio, { foreignKey: 'resourceId', constraints: false });
    TaskPdf.belongsTo(models.Speaking, { foreignKey: 'resourceId', constraints: false });
    TaskPdf.belongsTo(models.Writing, { foreignKey: 'resourceId', constraints: false });
    TaskPdf.belongsTo(models.Reading, { foreignKey: 'resourceId', constraints: false });
    TaskPdf.belongsTo(models.Story, { foreignKey: 'resourceId', constraints: false });
    TaskPdf.belongsTo(models.Blog, { foreignKey: 'resourceId', constraints: false });
    TaskPdf.belongsTo(models.EslVideo, { foreignKey: 'resourceId', constraints: false });
    TaskPdf.belongsTo(models.EslAudio, { foreignKey: 'resourceId', constraints: false });
  };

  return TaskPdf;
};

