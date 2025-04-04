using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using MvvmDialogs;

namespace Dm8Main.Base
{
    public interface IClosableWindow : IWindow
    {
        void Close();
    }
}
