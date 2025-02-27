using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;

namespace Dm8Main.Models;

public class SourceMapping : Prism.Mvvm.BindableBase
{
    #region Property IsChecked
    public bool IsChecked
    {
        get => this.isChecked;
        set => this.SetProperty(ref this.isChecked, value);
    }

    private bool isChecked;
    #endregion

    #region Property StageModel
    public Dm8Data.Stage.ModelEntry StageModel
    {
        get => this.stageModel;
        set => this.SetProperty(ref this.stageModel, value);
    }

    private Dm8Data.Stage.ModelEntry stageModel;
    #endregion

    #region Property SourceEntity
    public Dm8Data.Core.SourceEntity SourceEntity
    {
        set => this.SetProperty(ref this.sourceEntity, value);
        get => this.sourceEntity;
    }

    private Dm8Data.Core.SourceEntity sourceEntity;
    #endregion


}