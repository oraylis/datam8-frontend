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

using Dm8Locator.Db.TSql;
using System;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Runtime.Serialization;
using System.Security.Permissions;
using System.Text.Json.Serialization;
using System.Xml.Serialization;

namespace Dm8Locator
{
    /// <summary>
    /// Abstract locator representing the path to a data resource
    /// e.g. /dwh/serving/delivery/controlling/costElement/
    /// </summary>
    /// <seealso cref="System.Runtime.Serialization.ISerializable" />
    [Serializable]
    public abstract class Dm8LocatorBase : ISerializable, IEquatable<Dm8LocatorBase>
    {
        #region Readonly members

        /// <summary>
        /// Invalid characters for a data resource locator
        /// </summary>
        private static readonly char[] Dm8DataLocatorInvalidChars = { '\\' };// , '$' };

        /// <summary>
        /// The separator for data resource locators
        /// </summary>
        public static readonly char Dm8DataLocatorSeperator = '/';
        #endregion

        #region Public Properties
        /// <summary>
        /// The string representation of the data resource type
        /// </summary>
        [XmlAttribute("$type")]
        [JsonPropertyName("$type")]
        public string Dm8DataLocatorType
        {
            get => this.Dm8DataLocatorType;
            set
            {
                if (this.dm8DataLocatorType == null || this.dm8DataLocatorType != value)
                    this.dm8DataLocatorType = value;
                else if (this.dm8DataLocatorType != value)
                    throw new InvalidOperationException($"Changing Dm8DataLocator values is not supported {this.Dm8DataLocatorType}");
            }

        }
        public string dm8DataLocatorType;

        /// <summary>
        /// The last name of the data locator
        /// </summary>
        [XmlIgnore]
        [JsonIgnore]
        public string Name
        {
            get
            {
                var part = this.Value;
                return part.Substring(part.LastIndexOf(Dm8DataLocatorSeperator) + 1);
            }
        }

        /// <summary>
        /// The string representation of the data resource locator
        /// </summary>
        [XmlAttribute("Adl")]
        [JsonPropertyName("Adl")]
        public string Value
        {
            get => this.value;
            set
            {
                if (this.value == null)
                    this.Init(value);
                else
                    throw new InvalidOperationException($"Changing Dm8DataLocator values is not supported {this.Value}");
            }
        }
        public string value;

        /// <summary>
        /// Gets the parent of the data resource locator
        /// </summary>
        /// <value>
        /// The parent.
        /// </value>
        [XmlIgnore]
        [JsonIgnore]
        public Dm8LocatorBase Parent { get; private set; }

        /// <summary>
        /// Gets a value indicating whether this instance is root resource locator.
        /// </summary>
        /// <value>
        ///   <c>true</c> if this instance is root; otherwise, <c>false</c>.
        /// </value>
        [XmlIgnore]
        [JsonIgnore]
        public bool IsRoot { get; private set; }

        /// <summary>
        /// Gets the type specific specialized properties.
        /// </summary>
        /// <value>
        /// The specialized properties.
        /// </value>
        [XmlIgnore]
        [JsonIgnore]
        public IDm8LocatorSpecializedProperties SpecializedProperties { get; set; }
        #endregion

        #region Constructors & Initializers
        public Dm8LocatorBase(bool isRoot = false)
        {
            // initialize object via string representation
            this.IsRoot = isRoot;
            this.Dm8DataLocatorType = this.GetType().Name;
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="DataRecource.Adl"/> class.
        /// </summary>
        /// <param name="dm8l">The data resource locator.</param>
        /// <exception cref="InvalidDm8LocatorException"></exception>
        public Dm8LocatorBase(string dm8l, bool isRoot = false)
        {
            // check in invalid characters are used in data resource locator
            if (dm8l.IndexOfAny(Dm8DataLocatorInvalidChars) != -1)
            {
                throw new InvalidDm8LocatorException(dm8l , "Dm8DataLocatorInvalidChars found");
            }

            // initialize object via string representation
            this.IsRoot = isRoot;
            this.Value = dm8l;
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="DataRecource.Adl"/> class.
        /// </summary>
        /// <param name="copy">The data resource locator to copy.</param>
        public Dm8LocatorBase(Dm8LocatorBase copy, bool isRoot = false)
        {
            this.IsRoot = isRoot;
            this.Value = copy.Value;
            this.Parent = copy.Parent;
        }

        /// <summary>
        /// Initializes a new instance of the <see cref="DataRecource.Adl"/> class (used for serialization).
        /// </summary>
        /// <param name="info">The information.</param>
        /// <param name="context">The context.</param>
        /// <exception cref="ArgumentNullException">info</exception>
        protected Dm8LocatorBase(SerializationInfo info, StreamingContext context)
        {
            if (info == null)
                throw new ArgumentNullException(nameof(info));

            // get data resource locator string representation
            this.IsRoot = info.GetBoolean("IsRoot");
            this.Value = info.GetString("Adl");
        }

        /// <summary>
        /// Initializes the specified Adl.
        /// </summary>
        /// <param name="adl">The Adl.</param>
        private void Init(string adl)
        {
            if (string.IsNullOrEmpty(adl))
                throw new InvalidDm8LocatorException(adl, "Dm8DataLocator is empty or null");

            // set data resource locator (separator used at start and end)
            this.Dm8DataLocatorType = this.GetType().Name;
            this.value = adl;
            if (!this.value.StartsWith(Dm8DataLocatorSeperator))
                this.value = Dm8DataLocatorSeperator + this.value;
            if (this.value.EndsWith(Dm8DataLocatorSeperator))
                this.value = this.value.Substring(0, this.value.Length - 1);

            // create parent
            var adlParent = this.Value.Substring(0, this.Value.LastIndexOf(Dm8DataLocatorSeperator));
            try
            {
                this.Parent = this.CreateParent(adlParent);
            }
            catch (Exception ex)
            {
                throw new AggregateException($"Not a valid dm8 locator {adl}; cannot create parent {adlParent}", ex);
            }

            // check if parent is valid (is root)
            if (this.IsRoot && this.Parent != null)
            {
                throw new InvalidDm8LocatorException(this.Value, "Resource Locator is root but has a parent resource");
            }
            else if (!this.IsRoot && this.Parent == null)
            {
                throw new InvalidDm8LocatorException(this.Value, "Resource Locator is not root and has no parent resource");
            }
        }
        #endregion

        #region Abstract method CreateParent and Create type specific properties
        /// <summary>
        /// Creates the parent data resource locator.
        /// </summary>
        /// <param name="dm8l">The string representation of the parent data resource locator.</param>
        /// <returns>Parent Data Resource Locator</returns>
        protected abstract Dm8LocatorBase CreateParent(string dm8l);
        #endregion

        #region Serializing
        /// <summary>
        /// Populates a <see cref="T:System.Runtime.Serialization.SerializationInfo" /> with the data needed to serialize the target object.
        /// </summary>
        /// <param name="info">The <see cref="T:System.Runtime.Serialization.SerializationInfo" /> to populate with data.</param>
        /// <param name="context">The destination (see <see cref="T:System.Runtime.Serialization.StreamingContext" />) for this serialization.</param>
        protected virtual void GetObjectData(SerializationInfo info, StreamingContext context)
        {
            info.AddValue("Adl", this.Value);
            info.AddValue("IsRoot", this.IsRoot);
        }

        /// <summary>
        /// Populates a <see cref="T:System.Runtime.Serialization.SerializationInfo" /> with the data needed to serialize the target object.
        /// </summary>
        /// <param name="info">The <see cref="T:System.Runtime.Serialization.SerializationInfo" /> to populate with data.</param>
        /// <param name="context">The destination (see <see cref="T:System.Runtime.Serialization.StreamingContext" />) for this serialization.</param>
        /// <exception cref="ArgumentNullException">info</exception>
        void ISerializable.GetObjectData(SerializationInfo info, StreamingContext context)
        {
            if (info == null)
                throw new ArgumentNullException(nameof(info));

            this.GetObjectData(info, context);
        }
        #endregion

        #region Comparing objects and Hashing
        /// <summary>
        /// Indicates whether the current object is equal to another object of the same type.
        /// </summary>
        /// <param name="other">An object to compare with this object.</param>
        /// <returns>
        ///   <see langword="true" /> if the current object is equal to the <paramref name="other" /> parameter; otherwise, <see langword="false" />.
        /// </returns>
        /// <exception cref="System.NotImplementedException"></exception>
        public bool Equals([AllowNull] Dm8LocatorBase other)
        {
            return Dm8LocatorComparer.Default.Equals(this, other);
        }

        /// <summary>
        /// Indicates whether the current object is equal to another object of the same type.
        /// </summary>
        /// <param name="other">The other.</param>
        /// <returns></returns>
        public override bool Equals([AllowNull] Object other)
        {
            if (other is Dm8LocatorBase Adl)
            {
                return this.Equals(Adl);
            }
            return false;
        }

        /// <summary>
        /// Returns a hash code for this instance.
        /// </summary>
        /// <returns>
        /// A hash code for this instance, suitable for use in hashing algorithms and data structures like a hash table.
        /// </returns>
        public override int GetHashCode()
        {
            return this.Value.GetHashCode();
        }

        /// <summary>
        /// Implements the operator ==.
        /// </summary>
        /// <param name="lDm8l">The left Data Mate Address.</param>
        /// <param name="rDm8l">The right Data Mate Address.</param>
        /// <returns>
        /// The result of the operator.
        /// </returns>
        public static bool operator ==(Dm8LocatorBase lDm8l, Dm8LocatorBase rDm8l)
        {
            // Check for null.
            if (lDm8l is null)
            {
                if (rDm8l is null)
                {
                    // null == null = true.
                    return true;
                }

                // Only the left side is null.
                return false;
            }
            // Equals handles the case of null on right side.
            return lDm8l.Equals(rDm8l);
        }

        /// <summary>
        /// Implements the operator !=.
        /// </summary>
        /// <param name="lAdl">The l Adl.</param>
        /// <param name="rAdl">The r Adl.</param>
        /// <returns>
        /// The result of the operator.
        /// </returns>
        public static bool operator !=(Dm8LocatorBase leftAdl, Dm8LocatorBase rightAdl)
        {
            return !(leftAdl == rightAdl);
        }
        #endregion

        #region ToString
        /// <summary>
        /// Converts to string.
        /// </summary>
        /// <returns>
        /// A <see cref="System.String" /> that represents this instance.
        /// </returns>
        public new string ToString() => this.Value;

        protected static string Concat(string value, string entityName)
        {
            if (value.EndsWith(Dm8LocatorBase.Dm8DataLocatorSeperator))
                return string.Concat(value, entityName);
            else
                return string.Concat(value, Dm8LocatorBase.Dm8DataLocatorSeperator, entityName);
        }
        #endregion
    }

}
