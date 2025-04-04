using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using ICSharpCode.AvalonEdit;
using ICSharpCode.AvalonEdit.Folding;
using Microsoft.Xaml.Behaviors;
using static System.Windows.Forms.VisualStyles.VisualStyleElement.TextBox;

namespace Dm8Main.Avalon
{
    public class TextEditorExt : TextEditor, INotifyPropertyChanged
    {
        private static DependencyProperty caretOffsetProperty =
            DependencyProperty.Register("CaretOffset", typeof(int), typeof(TextEditorExt),
            // binding changed callback: set value of underlying property
            new PropertyMetadata((obj, args) =>
            {
                TextEditorExt target = (TextEditorExt)obj;
                target.CaretOffset = (int)args.NewValue;
            })
        );


        public new int CaretOffset
        {
            get => base.CaretOffset;
            set => base.CaretOffset = value;
        }

        private int columnPos = 0;
        public int ColumnPos => this.columnPos;

        private int linePos = 0;
        public int LinePos => this.linePos;

        public static DependencyProperty CaretOffsetProperty { get => caretOffsetProperty; set => caretOffsetProperty = value; }

        public TextEditorExt()
        {
            this.KeyUp += this.TextEditorExt_KeyUp;
            this.KeyDown += this.TextEditorExt_KeyDown;            
            this.MouseLeftButtonUp += this.TextEditorExt_MouseLeftButtonUp;
            this.MouseLeftButtonDown += this.TextEditorExt_MouseLeftButtonDown;
            this.PreviewMouseLeftButtonDown += this.TextEditorExt_PreviewMouse;
            this.PreviewMouseLeftButtonUp += this.TextEditorExt_PreviewMouse;
            this.Loaded += this.TextEditorExt_Loaded;
            this.ShowLineNumbers = true;
        }

        private void TextEditorExt_Loaded(object sender, RoutedEventArgs e)
        {
            this.CaretOffset = this.Text.Length == 0 ? 0 : 1;
            this.ComputPos();            
        }

        private void TextEditorExt_PreviewMouse(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            this.ComputPos();
            e.Handled = false;
        }

        private void TextEditorExt_MouseLeftButtonUp(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            this.ComputPos();
        }

        private void TextEditorExt_MouseLeftButtonDown(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            this.ComputPos();
        }

        private void TextEditorExt_KeyUp(object sender, System.Windows.Input.KeyEventArgs e)
        {
            this.ComputPos();
        }

        private void TextEditorExt_KeyDown(object sender, System.Windows.Input.KeyEventArgs e)
        {
            this.ComputPos();
        }


        protected void ComputPos()
        {
            var loc = this.Document.GetLocation(this.CaretOffset);
            this.linePos = loc.Line;
            this.columnPos = loc.Column;
            this.RaisePropertyChanged(nameof(this.LinePos));
            this.RaisePropertyChanged(nameof(this.ColumnPos));            
        }

        public event PropertyChangedEventHandler PropertyChanged;
        public void RaisePropertyChanged(string info)
        {
            this.PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(info));
        }
    }
}
