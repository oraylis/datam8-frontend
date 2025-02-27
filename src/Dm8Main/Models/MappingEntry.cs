namespace Dm8Main.Models;

public class MappingEntry : Prism.Mvvm.BindableBase
{
    #region Property Name
    public string Name
    {
        get => this.name;
        set => this.SetProperty(ref this.name, value);
    }

    public string name;
    #endregion

    #region Property SourceName
    public string SourceName
    {
        get => this.sourceName;
        set => this.SetProperty(ref this.sourceName, value);
    }

    public string sourceName;
    #endregion

    #region Property SourceComputation
    public string SourceComputation
    {
        get => this.sourceComputation;
        set => this.SetProperty(ref this.sourceComputation, value);
    }

    public string sourceComputation;
    #endregion

    #region Property StageEntity
    public Dm8Data.Stage.StageEntity StageEntity
    {
        get => this.stageEntity;
        set => this.SetProperty(ref this.stageEntity, value);
    }

    private Dm8Data.Stage.StageEntity stageEntity;
    #endregion
}