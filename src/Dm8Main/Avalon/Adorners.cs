using System;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Threading;

namespace Dm8Main.Avalon
{
    public class Adorners
    {
        // Template attached property

        public static readonly DependencyProperty TemplateProperty =
            DependencyProperty.RegisterAttached("Template", typeof(ControlTemplate), typeof(Adorners),
            new PropertyMetadata(TemplateChanged));

        public static ControlTemplate GetTemplate(UIElement target)
        {
            return (ControlTemplate)target.GetValue(TemplateProperty);
        }
        public static void SetTemplate(UIElement target, ControlTemplate value)
        {
            target.SetValue(TemplateProperty, value);
        }
        private static void TemplateChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        {
            UpdateAdroner((UIElement)d, GetIsVisible((UIElement)d), (ControlTemplate)e.NewValue);
        }

        // IsVisible attached property

        public static readonly DependencyProperty IsVisibleProperty =
            DependencyProperty.RegisterAttached("IsVisible", typeof(bool), typeof(Adorners),
            new PropertyMetadata(IsVisibleChanged));
        public static bool GetIsVisible(UIElement target)
        {
            return (bool)target.GetValue(IsVisibleProperty);
        }
        public static void SetIsVisible(UIElement target, bool value)
        {
            target.SetValue(IsVisibleProperty, value);
        }
        private static void IsVisibleChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
        {
            UpdateAdroner((UIElement)d, (bool)e.NewValue, GetTemplate((UIElement)d));
        }

        // InternalAdorner attached property

        public static readonly DependencyProperty InternalAdornerProperty =
            DependencyProperty.RegisterAttached("InternalAdorner", typeof(ControlAdorner), typeof(Adorners));

        public static ControlAdorner GetInteranlAdorner(DependencyObject target)
        {
            return (ControlAdorner)target.GetValue(InternalAdornerProperty);
        }
        public static void SetInternalAdorner(DependencyObject target, ControlAdorner value)
        {
            target.SetValue(InternalAdornerProperty, value);
        }

        // Actually do all the work:

        private static void UpdateAdroner(UIElement adorned)
        {
            UpdateAdroner(adorned, GetIsVisible(adorned), GetTemplate(adorned));
        }

        private static void UpdateAdroner(UIElement adorned, bool isVisible, ControlTemplate controlTemplate)
        {
            var layer = AdornerLayer.GetAdornerLayer(adorned);

            if (layer == null)
            {
                // if we don't have an adorner layer it's probably
                // because it's too early in the window's construction
                // Let's re-run at a slightly later time
                Dispatcher.CurrentDispatcher.BeginInvoke(
                    DispatcherPriority.Loaded,
                    new Action<UIElement>(o => UpdateAdroner(o)), adorned);
                return;
            }

            var existingAdorner = GetInteranlAdorner(adorned);

            if (existingAdorner == null)
            {
                if (controlTemplate != null && isVisible)
                {
                    // show
                    var newAdorner = new ControlAdorner(adorned)
                    {
                        Child = new Control() { Template = controlTemplate, Focusable = false, }
                    };
                    layer.Add(newAdorner);
                    SetInternalAdorner(adorned, newAdorner);
                }
            }
            else
            {
                if (controlTemplate != null && isVisible)
                {
                    // switch template
                    Control ctrl = existingAdorner.Child;
                    ctrl.Template = controlTemplate;
                }
                else
                {
                    // hide
                    existingAdorner.Child = null;
                    layer.Remove(existingAdorner);
                    SetInternalAdorner(adorned, null);
                }
            }
        }
    }
}
