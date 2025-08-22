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
using System.Linq.Expressions;
using System.Reflection;

namespace Dm8Data.Validate
{
   public class ValidateHelper
   {

      public static string GetPropertyName(Expression property)
      {
         LambdaExpression lambda = (LambdaExpression)property;
         MemberExpression memberExpression;

         if (lambda.Body is UnaryExpression unaryExpression)
         {
            memberExpression = (MemberExpression)(unaryExpression.Operand);
         }
         else
         {
            memberExpression = (MemberExpression)(lambda.Body);
         }

         return ((PropertyInfo)memberExpression.Member).Name;
      }

      public static Tuple<string ,string> GetReferenceNames(Expression property)
      {
         LambdaExpression lambda = (LambdaExpression)property;

         if (lambda.Body is NewExpression newExpression)
         {
            string item1 = newExpression.Arguments.Count > 0 ? GetReferencePropertyName(newExpression.Arguments[0]) : null;
            string item2 = newExpression.Arguments.Count > 1 ? GetReferencePropertyName(newExpression.Arguments[1]) : null;
            return new Tuple<string ,string>(item1 ,item2);
         }

         return new Tuple<string ,string>("#" ,"#"); ;
      }

      private static string GetReferencePropertyName(Expression expression)
      {
         if (expression is MemberExpression memberExpression)
         {
            return memberExpression.Member.Name;
         }
         return "#";
      }
   }
}