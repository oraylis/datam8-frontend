﻿/* DataM8
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

// Generated by DataM8
//----------------------
// <auto-generated>
//     Generated using the NJsonSchema v11.1.0.0 (Newtonsoft.Json v13.0.3.0) (http://NJsonSchema.org)
// </auto-generated>
//----------------------


namespace Dm8Data.Index
{
    #pragma warning disable // Disable all warnings

    [System.CodeDom.Compiler.GeneratedCode("NJsonSchema", "11.1.0.0 (Newtonsoft.Json v13.0.3.0)")]
    public partial class IndexEntry : Prism.Mvvm.BindableBase
    {
        private string _locator;
        private string _name;
        private string _absPath;
        private System.Collections.Generic.ICollection<string> _references;

        [Newtonsoft.Json.JsonProperty("locator", Required = Newtonsoft.Json.Required.Always)]
        [System.ComponentModel.DataAnnotations.Required(AllowEmptyStrings = true)]
        public string Locator
        {
            get { return _locator; }

            set { SetProperty(ref _locator, value); }
        }

        [Newtonsoft.Json.JsonProperty("name", Required = Newtonsoft.Json.Required.Always)]
        [System.ComponentModel.DataAnnotations.Required(AllowEmptyStrings = true)]
        public string Name
        {
            get { return _name; }

            set { SetProperty(ref _name, value); }
        }

        [Newtonsoft.Json.JsonProperty("absPath", Required = Newtonsoft.Json.Required.Always)]
        [System.ComponentModel.DataAnnotations.Required(AllowEmptyStrings = true)]
        public string AbsPath
        {
            get { return _absPath; }

            set { SetProperty(ref _absPath, value); }
        }

        [Newtonsoft.Json.JsonProperty("references", Required = Newtonsoft.Json.Required.DisallowNull, NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore)]
        public System.Collections.Generic.ICollection<string> References
        {
            get { return _references; }

            set { SetProperty(ref _references, value); }
        }



        private System.Collections.Generic.IDictionary<string, object> _additionalProperties;

        [Newtonsoft.Json.JsonExtensionData]
        public System.Collections.Generic.IDictionary<string, object> AdditionalProperties
        {
            get { return _additionalProperties ?? (_additionalProperties = new System.Collections.Generic.Dictionary<string, object>()); }
            set { _additionalProperties = value; }
        }

    }

    [System.CodeDom.Compiler.GeneratedCode("NJsonSchema", "11.1.0.0 (Newtonsoft.Json v13.0.3.0)")]
    public partial class Index : Prism.Mvvm.BindableBase
    {
        private RawIndex _rawIndex;
        private StageIndex _stageIndex;
        private CoreIndex _coreIndex;
        private CuratedIndex _curatedIndex;

        [Newtonsoft.Json.JsonProperty("rawIndex", Required = Newtonsoft.Json.Required.DisallowNull, NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore)]
        public RawIndex RawIndex
        {
            get { return _rawIndex; }

            set { SetProperty(ref _rawIndex, value); }
        }

        [Newtonsoft.Json.JsonProperty("stageIndex", Required = Newtonsoft.Json.Required.DisallowNull, NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore)]
        public StageIndex StageIndex
        {
            get { return _stageIndex; }

            set { SetProperty(ref _stageIndex, value); }
        }

        [Newtonsoft.Json.JsonProperty("coreIndex", Required = Newtonsoft.Json.Required.DisallowNull, NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore)]
        public CoreIndex CoreIndex
        {
            get { return _coreIndex; }

            set { SetProperty(ref _coreIndex, value); }
        }

        [Newtonsoft.Json.JsonProperty("curatedIndex", Required = Newtonsoft.Json.Required.DisallowNull, NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore)]
        public CuratedIndex CuratedIndex
        {
            get { return _curatedIndex; }

            set { SetProperty(ref _curatedIndex, value); }
        }



        private System.Collections.Generic.IDictionary<string, object> _additionalProperties;

        [Newtonsoft.Json.JsonExtensionData]
        public System.Collections.Generic.IDictionary<string, object> AdditionalProperties
        {
            get { return _additionalProperties ?? (_additionalProperties = new System.Collections.Generic.Dictionary<string, object>()); }
            set { _additionalProperties = value; }
        }

    }

    [System.CodeDom.Compiler.GeneratedCode("NJsonSchema", "11.1.0.0 (Newtonsoft.Json v13.0.3.0)")]
    public partial class RawIndex : Prism.Mvvm.BindableBase
    {
        private System.Collections.Generic.ICollection<IndexEntry> _entry;

        [Newtonsoft.Json.JsonProperty("entry", Required = Newtonsoft.Json.Required.DisallowNull, NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore)]
        public System.Collections.Generic.ICollection<IndexEntry> Entry
        {
            get { return _entry; }

            set { SetProperty(ref _entry, value); }
        }


    }

    [System.CodeDom.Compiler.GeneratedCode("NJsonSchema", "11.1.0.0 (Newtonsoft.Json v13.0.3.0)")]
    public partial class StageIndex : Prism.Mvvm.BindableBase
    {
        private System.Collections.Generic.ICollection<IndexEntry> _entry;

        [Newtonsoft.Json.JsonProperty("entry", Required = Newtonsoft.Json.Required.DisallowNull, NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore)]
        public System.Collections.Generic.ICollection<IndexEntry> Entry
        {
            get { return _entry; }

            set { SetProperty(ref _entry, value); }
        }


    }

    [System.CodeDom.Compiler.GeneratedCode("NJsonSchema", "11.1.0.0 (Newtonsoft.Json v13.0.3.0)")]
    public partial class CoreIndex : Prism.Mvvm.BindableBase
    {
        private System.Collections.Generic.ICollection<IndexEntry> _entry;

        [Newtonsoft.Json.JsonProperty("entry", Required = Newtonsoft.Json.Required.DisallowNull, NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore)]
        public System.Collections.Generic.ICollection<IndexEntry> Entry
        {
            get { return _entry; }

            set { SetProperty(ref _entry, value); }
        }


    }

    [System.CodeDom.Compiler.GeneratedCode("NJsonSchema", "11.1.0.0 (Newtonsoft.Json v13.0.3.0)")]
    public partial class CuratedIndex : Prism.Mvvm.BindableBase
    {
        private System.Collections.Generic.ICollection<IndexEntry> _entry;

        [Newtonsoft.Json.JsonProperty("entry", Required = Newtonsoft.Json.Required.DisallowNull, NullValueHandling = Newtonsoft.Json.NullValueHandling.Ignore)]
        public System.Collections.Generic.ICollection<IndexEntry> Entry
        {
            get { return _entry; }

            set { SetProperty(ref _entry, value); }
        }


    }
}
