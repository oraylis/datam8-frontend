using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Windows.Controls;
using System.Windows;
using AvalonDock.Layout;

namespace Dm8Main.Avalon
{

    class TemplateSelector : DataTemplateSelector
    {
        public TemplateSelector()
        {

        }

        public override DataTemplate SelectTemplate(object item, DependencyObject container)
        {
            return base.SelectTemplate(item, container);
        }
    }
}


