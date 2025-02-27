using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using Dm8Main.ViewModels;
using Dm8Main.Views;

namespace Dm8Main.Avalon
{
    public class ActStyleSelector : StyleSelector
    {
        public Style AnchorViewStyle
        {
            get;
            set;
        }


        public Style DocumentViewStyle
        {
            get;
            set;
        }

        public override Style SelectStyle(object item, DependencyObject container)
        {
            if (item is IDocumentView)
                return this.DocumentViewStyle;

            if (item is IAnchorView)
                return this.AnchorViewStyle;;

            return base.SelectStyle(item, container);
        }
    }
}

