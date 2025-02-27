namespace Dm8Main.Models;

public class RelationshipAttribute : Prism.Mvvm.BindableBase
{
    #region Property Attribute
    public Dm8Data.Core.Attribute Attribute
    {
        get => this.attribute;
        set => this.SetProperty(ref this.attribute, value);
    }

    private Dm8Data.Core.Attribute attribute;
    #endregion

    #region Property Relationship
    public Dm8Data.Core.Relationship Relationship
    {
        get => this.relationship;
        set => this.SetProperty(ref this.relationship, value);
    }

    private Dm8Data.Core.Relationship relationship;
    #endregion
}