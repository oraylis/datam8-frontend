/* DataM8
 * Copyright (C) 2024-2025 ORAYLIS GmbH
 *
 * This file is part of DataM8.
 *
 * DataM8 is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * DataM8 is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

using System.Windows;
using Dm8DuckDbConnector.Classes;
using Microsoft.Win32;

namespace Dm8DuckDbConnector.Views
{
#pragma warning disable CS8629 // Nullable value type may be null.
#pragma warning disable CS8600 // Nullable value type may be null.

   public partial class ConfigureView:Window
   {
      #region Properties
      private bool _screenInitDone = false;
      private DataSourceDuckDb _source = new DataSourceDuckDb();
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
      public DataSourceDuckDb Source
      {
         get
         {
            _source.FilePath = FilePath.Text;
            return _source;
         }
         set
         {
            _source = value;
            DataSourceName.Text = value?.Name ?? "";
            FilePath.Text = value?.FilePath ?? "";
            this.validateContent();
         }
      }
      #endregion

      #region .ctor & init
      public ConfigureView()
      {
         InitializeComponent();
         _screenInitDone = true;
         validateContent();
      }
      #endregion

      #region ControlEvents
      private void OnControlChanged(object sender ,System.Windows.Controls.TextChangedEventArgs e)
      {
         this.validateContent();
      }

      private void BrowseButton_Click(object sender ,RoutedEventArgs e)
      {
         OpenFileDialog openFileDialog = new OpenFileDialog
         {
            Filter = "DuckDB files (*.duckdb)|*.duckdb|All files (*.*)|*.*" ,
            FilterIndex = 1 ,
            RestoreDirectory = true
         };

         if (openFileDialog.ShowDialog() == true)
         {
            FilePath.Text = openFileDialog.FileName;
            validateContent();
         }
      }

      private void TestConnectionButton_Click(object sender ,RoutedEventArgs e)
      {
         this.Source.Validate(true);
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
      #endregion

      #region Validator
      private void validateContent()
      {
         if (!_screenInitDone)
         {
            return;
         }

         bool validState = true;
         bool testState = true;

         if (String.IsNullOrEmpty(DataSourceName.Text))
         {
            validState = false;
         }
         if (String.IsNullOrEmpty(FilePath.Text))
         {
            validState = false;
            testState = false;
         }
         OkButton.IsEnabled = validState;
         TestConnectionButton.IsEnabled = testState;
      }
      #endregion
   }
}

