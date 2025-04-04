using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using ICSharpCode.AvalonEdit;
using ICSharpCode.AvalonEdit.Highlighting;
using Microsoft.Xaml.Behaviors;

namespace Dm8Main.Avalon
{
    public sealed class AvalonEditBehaviour : Behavior<TextEditor>
    {
        public static readonly DependencyProperty TextBindingProperty =
            DependencyProperty.Register("TextBinding", typeof(string), typeof(AvalonEditBehaviour),
            new FrameworkPropertyMetadata(default(string), FrameworkPropertyMetadataOptions.BindsTwoWayByDefault, PropertyTextChangedCallback));

        public string TextBinding
        {
            get => (string)this.GetValue(TextBindingProperty);
            set => this.SetValue(TextBindingProperty, value);
        }

        public static readonly DependencyProperty SyntaxHighlightingBindingProperty =
            DependencyProperty.Register("SyntaxHighlightingBinding", typeof(IHighlightingDefinition), typeof(AvalonEditBehaviour),
            new FrameworkPropertyMetadata(null, FrameworkPropertyMetadataOptions.BindsTwoWayByDefault, PropertySyntaxHighlightingChangedCallback));

        public IHighlightingDefinition SyntaxHighlightingBinding
        {
            get => (IHighlightingDefinition)this.GetValue(SyntaxHighlightingBindingProperty);
            set => this.SetValue(SyntaxHighlightingBindingProperty, value);
        }


        protected override void OnAttached()
        {
            base.OnAttached();
            if (this.AssociatedObject != null)
            {
                this.AssociatedObject.TextChanged += this.AssociatedObjectOnTextChanged;
                this.AssociatedObject.Document.Text = this.TextBinding ?? string.Empty;
                this.AssociatedObject.SyntaxHighlighting = this.SyntaxHighlightingBinding;
            }
        }

        protected override void OnDetaching()
        {
            base.OnDetaching();
            if (this.AssociatedObject != null) this.AssociatedObject.TextChanged -= this.AssociatedObjectOnTextChanged;
        }

        private void AssociatedObjectOnTextChanged(object sender, EventArgs eventArgs)
        {
            var textEditor = sender as TextEditor;
            if (textEditor?.Document != null) this.TextBinding = textEditor.Document.Text;
        }

        private static void PropertyTextChangedCallback(
            DependencyObject dependencyObject,
            DependencyPropertyChangedEventArgs dependencyPropertyChangedEventArgs)
        {
            var behavior = (AvalonEditBehaviour)dependencyObject;
            var editor = behavior.AssociatedObject;
            if (editor?.Document != null)
            {
                var oldText = editor.Document.Text;
                var newText = (dependencyPropertyChangedEventArgs.NewValue ?? "").ToString();

                if (oldText != newText)
                {
                    var caretOffset = editor.CaretOffset;
                    editor.Document.Text = (dependencyPropertyChangedEventArgs.NewValue ?? "").ToString();
                    editor.CaretOffset = Math.Max(0, Math.Min((dependencyPropertyChangedEventArgs.NewValue ?? "").ToString().Length, caretOffset));
                }
            }
        }

        private static void PropertySyntaxHighlightingChangedCallback(DependencyObject dependencyObject, DependencyPropertyChangedEventArgs dependencyPropertyChangedEventArgs)
        {
            var behavior = (AvalonEditBehaviour)dependencyObject;
            var editor = behavior.AssociatedObject;
            if (editor != null)
            {                
                editor.SyntaxHighlighting = behavior.SyntaxHighlightingBinding;
            }
        }
    }
}
