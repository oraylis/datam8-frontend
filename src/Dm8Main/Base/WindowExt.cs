using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using MvvmDialogs;

namespace Dm8Main.Base
{
    public static class WindowExt
    {
        public static StringCollection StoreState(this Window This)
        {
            var rc = new StringCollection();
            rc.Add(This.Left.ToString());
            rc.Add(This.Top.ToString());
            rc.Add(This.Width.ToString());
            rc.Add(This.Height.ToString());
            rc.Add(This.WindowState.ToString());
            return rc;
        }

        public static void RestoreState(this Window This, StringCollection state)
        {
            try
            {
                This.Left = double.Parse(state[0]);
                This.Top = double.Parse(state[1]);
                This.Width = double.Parse(state[2]);
                This.Height = double.Parse(state[3]);
                This.WindowState = Enum.Parse<WindowState>(state[4]);
            }
            catch 
            {
            }
        }
    }
}
