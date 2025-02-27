using System.ComponentModel;

namespace Dm8Main.ViewModels.Dialog;

public interface IHamburgerViewModel : INotifyPropertyChanged
{
    public int NumSelectablePages { get; }
}