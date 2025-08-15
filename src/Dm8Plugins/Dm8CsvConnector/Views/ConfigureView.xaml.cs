using System.Windows;
using System.Windows.Controls;
using Dm8CSVConnector.Classes;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Win32;

namespace Dm8CSVConnector.Views
{
#pragma warning disable IDE0079 // Remove unnecessary suppression
#pragma warning disable CS8629 // Nullable value type may be null.
#pragma warning disable CS8600 // Nullable value type may be null.
#pragma warning disable CS8601 // Nullable value type may be null.
#pragma warning disable IDE0130 // Namespace does not match folder structure
#pragma warning disable IDE0090
#pragma warning disable IDE0028
#pragma warning disable IDE0060
#pragma warning disable IDE1006
#pragma warning disable CA1822 // Mark members as static

   public partial class ConfigureView:Window
   {
      #region Properties
      private DataSourceCSV _source = new DataSourceCSV();
      private bool _initDone = false;
      public FieldProperty? CurrentField
      {
         get
         {
            return (_currentField);
         }
         set
         {
            _initDone = false;
            _currentField = value;
            Field_Name.Text = _currentField?.Name;
            Field_Type.Text = _currentField?.Type;
            Field_IsNullable.IsChecked = _currentField?.NullEnabled;
            Field_Size.Text = _currentField?.Size?.ToString();
            Field_Precision.Text = _currentField?.Precision?.ToString();
            _initDone = true;
         }
      }
      private FieldProperty? _currentField = new FieldProperty();
      public string DataSourcename
      {
         get
         {
            return (DataSourceName.Text);
         }
         set
         {
            DataSourceName.Text = value;
         }
      }
      public DataSourceCSV Source
      {
         get
         {
            if (_source.OriginalName.IsNullOrEmpty())
            {
               _source.FileName = SourceFileName.Text;
            }
            _source.Converter.HeaderHasFieldnames = (bool)HeaderFirstLine.IsChecked;
            switch (OEMorANSI.SelectedIndex)
            {
               case 0:
                  _source.Converter.ReadFileAs = ConvertProperty.ReadFileAsProp.ANSI;
                  break;
               case 1:
                  _source.Converter.ReadFileAs = ConvertProperty.ReadFileAsProp.OEM;
                  break;
            }
            switch (FieldSeparator.SelectedIndex)
            {
               case 0:
                  _source.Converter.Delimiter = ConvertProperty.DelimiterProp.Semicolon;
                  break;
               case 1:
                  _source.Converter.Delimiter = ConvertProperty.DelimiterProp.Comma;
                  break;
               case 2:
                  _source.Converter.Delimiter = ConvertProperty.DelimiterProp.Tab;
                  break;
            }
            switch (LineSeparator.SelectedIndex)
            {
               case 0:
                  _source.Converter.Separator = ConvertProperty.SeparatorProp.CRLF;
                  break;
               case 1:
                  _source.Converter.Separator = ConvertProperty.SeparatorProp.CR;
                  break;
               case 2:
                  _source.Converter.Separator = ConvertProperty.SeparatorProp.LF;
                  break;
            }
            return _source;
         }
         set
         {
            _source = value;
            if (_source.OriginalName.IsNullOrEmpty())
            {
               SourceFileName.Text = _source.FileName;
            }
            else
            {
               SourceFileName.Text = _source.OriginalName;
               SourceFileName.IsEnabled = false;
               DataSourceName.IsEnabled = false;
               txtDataSourceName.Visibility = Visibility.Hidden;
               DataSourceName.Visibility = Visibility.Hidden;
               SelectFile.IsEnabled = false;
            }
            _initDone = true;
            switch (_source.Converter.ReadFileAs)
            {
               case ConvertProperty.ReadFileAsProp.ANSI:
                  OEMorANSI.SelectedIndex = 0;
                  break;
               case ConvertProperty.ReadFileAsProp.OEM:
                  OEMorANSI.SelectedIndex = 1;
                  break;
            }
            switch (_source.Converter.Separator)
            {
               case ConvertProperty.SeparatorProp.CRLF:
                  LineSeparator.SelectedIndex = 0;
                  break;
               case ConvertProperty.SeparatorProp.CR:
                  LineSeparator.SelectedIndex = 1;
                  break;
               case ConvertProperty.SeparatorProp.LF:
                  LineSeparator.SelectedIndex = 2;
                  break;
            }
            switch (_source.Converter.Delimiter)
            {
               case ConvertProperty.DelimiterProp.Semicolon:
                  FieldSeparator.SelectedIndex = 0;
                  break;
               case ConvertProperty.DelimiterProp.Comma:
                  FieldSeparator.SelectedIndex = 1;
                  break;
               case ConvertProperty.DelimiterProp.Tab:
                  FieldSeparator.SelectedIndex = 2;
                  break;
            }
            HeaderFirstLine.IsChecked = _source.Converter.HeaderHasFieldnames;
            this.validateContent();
            if (SourceFileName.IsEnabled == false)
            {
               try
               {
                  this.Source.AnalyseFile();
               }
               catch { }
            }

            this.LoadFields();
         }
      }
      #endregion

      #region .ctor & init
      public ConfigureView()
      {
         InitializeComponent();
         Details.Visibility = Visibility.Hidden;
         _initDone = true;
      }
      #endregion

      #region ControlEvents
      private void OnControlChanged(object sender ,RoutedEventArgs e)
      {
         this.validate(sender);
      }
      private void OnControlChanged(object sender ,SelectionChangedEventArgs e)
      {
         this.validate(sender);
      }
      private void OkButton_Click(object sender ,RoutedEventArgs e)
      {
         if (this.Source.Validate(false))
         {
            this.DialogResult = true;
         }
      }
      private void CancelButton_Click(object sender ,RoutedEventArgs e)
      {
         this.DialogResult = false;
      }
      private void ListBox_SelectionChanged(object sender ,SelectionChangedEventArgs e)
      {
         Details.Visibility = Visibility.Hidden;
         if (AllFields.SelectedItem != null)
         {
            Details.Visibility = Visibility.Visible;
            FieldProperty fp = AllFields.SelectedItem as FieldProperty;
            this.CurrentField = fp;
         }
      }
      private void OnTextChanged(object sender ,TextChangedEventArgs e)
      {
         if (_currentField == null || !_initDone)
         {
            return;
         }
         _currentField.Name = Field_Name.Text;
         if (Int32.TryParse(Field_Size.Text ,out int i1))
         {
            _currentField.Size = i1;
         }
         else
         {
            _currentField.Size = null;
         }
         if (Int32.TryParse(Field_Precision.Text ,out int i2))
         {
            _currentField.Precision = i2;
         }
         else
         {
            _currentField.Precision = null;
         }
         AllFields.Items.Refresh();
      }
      private void OnClicked(object sender ,RoutedEventArgs e)
      {
         if (_currentField == null || !_initDone)
         {
            return;
         }
         _currentField.NullEnabled = (bool)Field_IsNullable.IsChecked;
      }
      private void OnSelectionChanged(object sender ,SelectionChangedEventArgs e)
      {
         if (_currentField == null || !_initDone)
         {
            return;
         }

         if (Field_Type.SelectedItem != null)
         {
            _currentField.Type = Field_Type.SelectedItem.ToString();
         }
      }
      #endregion

      #region Validator
      private void validate(object sender)
      {
         this.validateContent();
      }
      private void validateContent()
      {
         bool validState = true;
         bool refreshState = true;

         if (String.IsNullOrEmpty(DataSourceName.Text))
         {
            validState = !DataSourceName.IsEnabled;
         }
         if (String.IsNullOrEmpty(SourceFileName.Text))
         {
            refreshState = false;
         }
         OkButton.IsEnabled = validState;
         RefreshButton.IsEnabled = refreshState;
      }
      #endregion

      private void SelectFile_OnClick(object sender ,RoutedEventArgs e)
      {
         OpenFileDialog of = new OpenFileDialog
         {
            AddExtension = true ,
            CheckFileExists = true ,
            CheckPathExists = true ,
            DefaultExt = ".csv" ,
            FileName = SourceFileName.Text ,
            Filter = "Textdateien (*.csv, *.txt)|*.csv;*.txt|Alle Dateien (*.*)|*.*"
         };
         if (of.ShowDialog() == true)
         {
            SourceFileName.Text = of.FileName;
         }

      }
      private void AddButton_Click(object sender ,RoutedEventArgs e)
      {

      }
      private void RemoveButton_Click(object sender ,RoutedEventArgs e)
      {

      }
      private void RefreshButton_Click(object sender ,RoutedEventArgs e)
      {
         try
         {
            Details.Visibility = Visibility.Hidden;
            this.Source.AnalyseFile();
         }
         catch (Exception ex)
         {
            MessageBox.Show(ex.Message);
         }
         LoadFields();
      }

      private void LoadFields()
      {
         if (this.Source.Schema.Count > 0)
         {
            AddButton.IsEnabled = false;
            RemoveButton.IsEnabled = false;
            AllFields.ItemsSource = this.Source.Schema;
            AllFields.SelectedIndex = 0;
         }
      }
   }
}
