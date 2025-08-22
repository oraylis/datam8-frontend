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

using System;
using Dm8Data.Validate.Exceptions;
using Newtonsoft.Json;

namespace Dm8Data.MessageOutput
{
   public class OutputItem:Prism.Mvvm.BindableBase
   {
      public OutputItem()
      {
      }

      public OutputItem(ModelReaderException validateException ,Solution solution)
      {
         // Base
         if (validateException.FilePath.Contains(solution.BaseFilePath ,StringComparison.InvariantCultureIgnoreCase))
         {
            this.Layer = Dm8Data.Properties.Resources.Layer_Base;
            this.Source = validateException.Source;
            this.Location = validateException.FilePath.Replace(solution.BaseFilePath ,"");
            if (string.IsNullOrEmpty(this.Location))
            {
               this.Location = validateException.Adl;
            }

            this.FilePath = validateException.FilePath;

            if (validateException is UnknownValidateException && validateException.InnerException is JsonSerializationException jsonSerializationException)
            {
               this.FillJsonException(validateException ,solution ,jsonSerializationException);
            }
            else
            {
               this.Code = validateException.Code;
               this.Description = validateException.Message;
            }
         }
         // Raw
         else if (validateException.FilePath.Contains(solution.RawFolderPath ,StringComparison.InvariantCultureIgnoreCase))
         {
            this.Layer = Dm8Data.Properties.Resources.Layer_Raw;
            this.Source = validateException.Source;
            this.Location = validateException.FilePath.Replace(solution.RawFolderPath ,"");
            if (string.IsNullOrEmpty(this.Location))
            {
               this.Location = validateException.Adl;
            }

            this.FilePath = validateException.FilePath;

            if (validateException is UnknownValidateException && validateException.InnerException is JsonSerializationException jsonSerializationException)
            {
               this.FillJsonException(validateException ,solution ,jsonSerializationException);
            }
            else
            {
               this.Code = validateException.Code;
               this.Description = validateException.Message;
            }
         }
         // Staging
         else if (validateException.FilePath.Contains(solution.StagingFolderPath ,StringComparison.InvariantCultureIgnoreCase))
         {
            this.Layer = Dm8Data.Properties.Resources.Layer_Stage;
            this.Source = validateException.Source;
            this.Location = validateException.FilePath.Replace(solution.StagingFolderPath ,"");
            if (string.IsNullOrEmpty(this.Location))
            {
               this.Location = validateException.Adl;
            }

            this.FilePath = validateException.FilePath;
            if (validateException is UnknownValidateException && validateException.InnerException is JsonSerializationException jsonSerializationException)
            {
               this.FillJsonException(validateException ,solution ,jsonSerializationException);
            }
            else
            {
               this.Code = validateException.Code;
               this.Description = validateException.Message;
            }
         }
         // Core
         else if (validateException.FilePath.Contains(solution.CoreFolderPath ,StringComparison.InvariantCultureIgnoreCase))
         {
            this.Layer = Dm8Data.Properties.Resources.Layer_Core;
            this.Source = validateException.Source;
            this.Location = validateException.FilePath.Replace(solution.CoreFolderPath ,"");
            if (string.IsNullOrEmpty(this.Location))
            {
               this.Location = validateException.Adl;
            }

            this.FilePath = validateException.FilePath;
            if (validateException is UnknownValidateException && validateException.InnerException is JsonSerializationException jsonSerializationException)
            {
               this.FillJsonException(validateException ,solution ,jsonSerializationException);
            }
            else
            {
               this.Code = validateException.Code;
               this.Description = validateException.Message;
            }
         }
         // Curated
         else if (validateException.FilePath.Contains(solution.CuratedFolderPath ,StringComparison.InvariantCultureIgnoreCase))
         {
            this.Layer = Dm8Data.Properties.Resources.Layer_Curated;
            this.Source = validateException.Source;
            this.Location = validateException.FilePath.Replace(solution.CuratedFolderPath ,"");
            if (string.IsNullOrEmpty(this.Location))
            {
               this.Location = validateException.Adl;
            }

            this.FilePath = validateException.FilePath;
            if (validateException is UnknownValidateException && validateException.InnerException is JsonSerializationException jsonSerializationException)
            {
               this.FillJsonException(validateException ,solution ,jsonSerializationException);
            }
            else
            {
               this.Code = validateException.Code;
               this.Description = validateException.Message;
            }
         }
      }

      private void FillJsonException(ModelReaderException modelReaderException ,Solution solution ,JsonSerializationException jsonSerializationException)
      {
         this.Code = "J001";
         this.Description = jsonSerializationException.Message;
         this.Line = jsonSerializationException.LineNumber;
      }


      #region Property Code
      public string Code
      {
         get => this.code;
         set => this.SetProperty(ref this.code ,value);
      }

      private string code;
      #endregion

      #region Property Description
      public string Description
      {
         get => this.description;
         set => this.SetProperty(ref this.description ,value);
      }

      private string description;
      #endregion

      #region Property Layer
      public string Layer
      {
         get => this.layer;
         set => this.SetProperty(ref this.layer ,value);
      }

      private string layer;
      #endregion

      #region Property Source
      public string Source
      {
         get => this.source;
         set => this.SetProperty(ref this.source ,value);
      }

      private string source;
      #endregion

      #region Property Location
      public string Location
      {
         get => this.location;
         set => this.SetProperty(ref this.location ,value);
      }

      private string location;
      #endregion

      #region Property FilePath
      public string FilePath
      {
         get => this.filePath;
         set => this.SetProperty(ref this.filePath ,value);
      }

      private string filePath;
      #endregion

      #region Property Line
      public int Line
      {
         get => this.line;
         set => this.SetProperty(ref this.line ,value);
      }

      private int line;
      #endregion

   }
}
