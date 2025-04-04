using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using Microsoft.SqlServer.TransactSql.ScriptDom;
using Attribute = Dm8Data.Core.Attribute;

namespace Dm8Main.Models;

public class EditRelationshipAttribute : Prism.Mvvm.BindableBase
{
    public EditRelationshipAttribute()
    {
        this.PropertyChanged += OnPropertyChanged;
    }

    private void OnPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        switch (e.PropertyName)
        {
            case nameof(this.Filter):
                this.FilterAttributes = new ObservableCollection<Attribute>(this.Attributes.Where(a => a.Name.Contains(this.Filter ?? string.Empty
                    , StringComparison.InvariantCultureIgnoreCase)));
                break;
        }
    }

    #region Property KeyAttribute
    public Dm8Data.Core.Attribute KeyAttribute
    {
        get => this.keyAttribute;
        set => this.SetProperty(ref this.keyAttribute, value);
    }

    private Dm8Data.Core.Attribute keyAttribute;
    #endregion

    #region Property Filter
    public string Filter
    {
        get => this.filter;
        set => this.SetProperty(ref this.filter, value);
    }

    private string filter;
    #endregion

    #region Property FilterAttributes
    public ObservableCollection<Attribute> FilterAttributes
    {
        get => this.filterAttributes;
        set => this.SetProperty(ref this.filterAttributes, value);
    }

    private ObservableCollection<Attribute> filterAttributes;
    #endregion

    #region Property SelectedAttribute
    public Dm8Data.Core.Attribute SelectedAttribute
    {
        get => this.selectedAttribute;
        set => this.SetProperty(ref this.selectedAttribute, value);
    }

    private Dm8Data.Core.Attribute selectedAttribute;
    #endregion

    #region Property Attributes
    public ObservableCollection<Attribute> Attributes
    {
        get => this.attributes;
        set => this.SetProperty(ref this.attributes, value);
    }

    private ObservableCollection<Attribute> attributes;
    #endregion

    #region Property OrderNr
    public int OrderNr
    {
        get => this.orderNr;
        set => this.SetProperty(ref this.orderNr, value);
    }

    private int orderNr;
    #endregion
}