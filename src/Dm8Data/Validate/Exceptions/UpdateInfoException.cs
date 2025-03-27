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
using Dm8Data.Helper;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Collections;

namespace Dm8Data.Validate.Exceptions
{
    public class UpdateInfoException : ModelReaderException
    {
        public const string MessageFormat0 = "Model update {0}";

        public UpdateInfoException(Exception ex, string filepath)
            : base("Model Update", ex)
        {
            this.Severity = SeverityType.Info;
            this.Code = "UPDATE";
            this.FilePath = filepath;
        }

        public UpdateInfoException(string msg, string filepath)
            : base("Model Update", new Exception(msg))
        {
            this.Severity = SeverityType.Info;
            this.Code = "UPDATE";
            this.FilePath = filepath;
        }

        public override string Message
        {
            get
            {
                return string.Format(MessageFormat0, this.InnerException?.Message);
            }
        }

        public override string Source
        {
            get
            {
                return this.FilePath;
            }
        }

    }
}
